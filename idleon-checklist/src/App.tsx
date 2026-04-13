import React, { useEffect, useMemo, useState } from 'react';
import {
    charactersSeed,
    tasksSeed,
    type CharacterProfile,
    type CompletionRecord,
    type Frequency,
    type Preferences,
    type Priority,
    type TaskDefinition,
    type WorldFilter,
} from './tasks';

type RenderableTask = {
    renderKey: string;
    task: TaskDefinition;
    character: CharacterProfile | null;
    isComplete: boolean;
    completionKey: string;
    world: number | 0;
};

const STORAGE_KEYS = {
    completions: 'idleon-checklist-v1-completions',
    preferences: 'idleon-checklist-v1-preferences',
    characters: 'idleon-checklist-v1-characters',
};

function getPeriodKey(frequency: Frequency) {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');

    if (frequency === 'daily') {
        return `${year}-${month}-${day}`;
    }

    if (frequency === 'monthly') {
        return `${year}-${month}`;
    }

    const start = new Date(now);
    const currentDay = start.getDay();
    const distanceFromMonday = (currentDay + 6) % 7;
    start.setDate(start.getDate() - distanceFromMonday);

    const weekYear = start.getFullYear();
    const weekMonth = String(start.getMonth() + 1).padStart(2, '0');
    const weekDay = String(start.getDate()).padStart(2, '0');
    return `${weekYear}-${weekMonth}-${weekDay}`;
}

function buildCompletionKey(taskId: string, characterId: string | null, periodKey: string) {
    return `${taskId}::${characterId ?? 'account'}::${periodKey}`;
}

function loadJson<T>(key: string, fallback: T): T {
    if (typeof window === 'undefined') {
        return fallback;
    }

    try {
        const raw = window.localStorage.getItem(key);
        return raw ? (JSON.parse(raw) as T) : fallback;
    }
    catch {
        return fallback;
    }
}

function saveJson<T>(key: string, value: T) {
    if (typeof window === 'undefined') {
        return;
    }

    window.localStorage.setItem(key, JSON.stringify(value));
}

function priorityWeight(priority: Priority) {
    if (priority === 'high') {
        return 3;
    }

    if (priority === 'medium') {
        return 2;
    }

    return 1;
}

function worldLabel(world: number | 0) {
    if (world === 0) {
        return 'Global';
    }

    return `World ${world}`;
}

function capitalize(value: string) {
    return value.charAt(0).toUpperCase() + value.slice(1);
}

function buttonStyle(active: boolean): React.CSSProperties {
    return {
        ...styles.button,
        ...(active ? styles.buttonActive : {}),
    };
}

function priorityBadgeStyle(priority: Priority): React.CSSProperties {
    if (priority === 'high') {
        return styles.priorityHigh;
    }

    if (priority === 'medium') {
        return styles.priorityMedium;
    }

    return styles.priorityLow;
}

function SectionTitle({ children }: { children: React.ReactNode }) {
    return <div style={styles.sectionTitle}>{children}</div>;
}

export default function IdleonChecklistAppCompactV1() {
    const [frequency, setFrequency] = useState<Frequency>('daily');
    const [worldFilter, setWorldFilter] = useState<WorldFilter>('all');
    const [search, setSearch] = useState('');
    const [showOptional, setShowOptional] = useState(true);
    const [selectedCharacterId, setSelectedCharacterId] = useState<string>('all');
    const [expandedSystems, setExpandedSystems] = useState<Record<string, boolean>>({});

    const [characters, setCharacters] = useState<CharacterProfile[]>(charactersSeed);
    const [completions, setCompletions] = useState<CompletionRecord[]>([]);
    const [preferences, setPreferences] = useState<Preferences>({
        hiddenTaskIds: [],
        favoriteTaskIds: [],
        hideCompleted: false,
    });

    useEffect(() => {
        setCharacters(loadJson<CharacterProfile[]>(STORAGE_KEYS.characters, charactersSeed));
        setCompletions(loadJson<CompletionRecord[]>(STORAGE_KEYS.completions, []));
        setPreferences(loadJson<Preferences>(STORAGE_KEYS.preferences, {
            hiddenTaskIds: [],
            favoriteTaskIds: [],
            hideCompleted: false,
        }));
    }, []);

    useEffect(() => {
        saveJson(STORAGE_KEYS.characters, characters);
    }, [characters]);

    useEffect(() => {
        saveJson(STORAGE_KEYS.completions, completions);
    }, [completions]);

    useEffect(() => {
        saveJson(STORAGE_KEYS.preferences, preferences);
    }, [preferences]);

    const enabledCharacters = useMemo(() => {
        return [...characters]
            .filter((character) => character.enabled)
            .sort((a, b) => a.sortOrder - b.sortOrder);
    }, [characters]);

    const currentPeriodKey = useMemo(() => getPeriodKey(frequency), [frequency]);

    const completionSet = useMemo(() => {
        return new Set(
            completions
                .filter((record) => record.periodKey === currentPeriodKey)
                .map((record) => record.key),
        );
    }, [completions, currentPeriodKey]);

    const renderableTasks = useMemo<RenderableTask[]>(() => {
        const entries: RenderableTask[] = [];

        for (const task of tasksSeed) {
            if (task.frequency !== frequency) {
                continue;
            }

            if (preferences.hiddenTaskIds.includes(task.id)) {
                continue;
            }

            if (!showOptional && task.optional) {
                continue;
            }

            if (worldFilter === 'favorites' && !preferences.favoriteTaskIds.includes(task.id)) {
                continue;
            }

            if (worldFilter === 'character' && task.scope !== 'character') {
                continue;
            }

            if (typeof worldFilter === 'number' && task.world !== worldFilter) {
                continue;
            }

            const matchesSearch = [
                task.title,
                task.description ?? '',
                task.system,
                task.category,
                ...task.tags,
            ]
                .join(' ')
                .toLowerCase()
                .includes(search.toLowerCase());

            if (!matchesSearch) {
                continue;
            }

            if (task.scope === 'account') {
                const completionKey = buildCompletionKey(task.id, null, currentPeriodKey);
                const isComplete = completionSet.has(completionKey);

                if (preferences.hideCompleted && isComplete) {
                    continue;
                }

                entries.push({
                    renderKey: completionKey,
                    task,
                    character: null,
                    isComplete,
                    completionKey,
                    world: task.world,
                });
                continue;
            }

            for (const character of enabledCharacters) {
                const selectedMatches = selectedCharacterId === 'all' || selectedCharacterId === character.id;
                if (!selectedMatches) {
                    continue;
                }

                const classAllowed = !task.requiresClasses || task.requiresClasses.includes(character.classGroup);
                if (!classAllowed) {
                    continue;
                }

                const completionKey = buildCompletionKey(task.id, character.id, currentPeriodKey);
                const isComplete = completionSet.has(completionKey);

                if (preferences.hideCompleted && isComplete) {
                    continue;
                }

                const characterSearchMatches = `${task.title} ${character.name} ${character.classGroup}`
                    .toLowerCase()
                    .includes(search.toLowerCase());

                if (search && !characterSearchMatches && !matchesSearch) {
                    continue;
                }

                entries.push({
                    renderKey: completionKey,
                    task,
                    character,
                    isComplete,
                    completionKey,
                    world: task.world,
                });
            }
        }

        return entries.sort((a, b) => {
            if (a.world !== b.world) {
                return a.world - b.world;
            }

            const favoriteDelta = Number(preferences.favoriteTaskIds.includes(b.task.id)) - Number(preferences.favoriteTaskIds.includes(a.task.id));
            if (favoriteDelta !== 0) {
                return favoriteDelta;
            }

            const priorityDelta = priorityWeight(b.task.priority) - priorityWeight(a.task.priority);
            if (priorityDelta !== 0) {
                return priorityDelta;
            }

            if (a.task.system !== b.task.system) {
                return a.task.system.localeCompare(b.task.system);
            }

            return a.task.title.localeCompare(b.task.title);
        });
    }, [completionSet, currentPeriodKey, enabledCharacters, frequency, preferences.favoriteTaskIds, preferences.hiddenTaskIds, preferences.hideCompleted, search, selectedCharacterId, showOptional, worldFilter]);

    const groupedTasks = useMemo(() => {
        const groups = new Map<string, RenderableTask[]>();

        for (const item of renderableTasks) {
            const key = `${item.world}::${item.task.system}`;
            const existing = groups.get(key) ?? [];
            existing.push(item);
            groups.set(key, existing);
        }

        return Array.from(groups.entries()).map(([key, items]) => {
            const [world, system] = key.split('::');
            const completed = items.filter((item) => item.isComplete).length;
            return {
                key,
                world: Number(world),
                system,
                items,
                completed,
                total: items.length,
            };
        });
    }, [renderableTasks]);

    const stats = useMemo(() => {
        const total = renderableTasks.length;
        const completed = renderableTasks.filter((task) => task.isComplete).length;
        const remaining = total - completed;
        const percent = total === 0 ? 0 : Math.round((completed / total) * 100);
        return { total, completed, remaining, percent };
    }, [renderableTasks]);

    function toggleTask(item: RenderableTask) {
        setCompletions((current) => {
            const exists = current.some((record) => record.key === item.completionKey);
            if (exists) {
                return current.filter((record) => record.key !== item.completionKey);
            }

            const record: CompletionRecord = {
                key: item.completionKey,
                taskId: item.task.id,
                characterId: item.character?.id ?? null,
                periodKey: currentPeriodKey,
                completedAt: new Date().toISOString(),
            };

            return [...current, record];
        });
    }

    function toggleFavorite(taskId: string) {
        setPreferences((current) => {
            const exists = current.favoriteTaskIds.includes(taskId);
            return {
                ...current,
                favoriteTaskIds: exists
                    ? current.favoriteTaskIds.filter((id) => id !== taskId)
                    : [...current.favoriteTaskIds, taskId],
            };
        });
    }

    function hideTask(taskId: string) {
        setPreferences((current) => {
            if (current.hiddenTaskIds.includes(taskId)) {
                return current;
            }

            return {
                ...current,
                hiddenTaskIds: [...current.hiddenTaskIds, taskId],
            };
        });
    }

    function resetCurrentFrequency() {
        setCompletions((current) => current.filter((record) => record.periodKey !== currentPeriodKey));
    }

    function resetAllData() {
        setCompletions([]);
        setPreferences({
            hiddenTaskIds: [],
            favoriteTaskIds: [],
            hideCompleted: false,
        });
        setCharacters(charactersSeed);
    }

    function toggleSystem(groupKey: string) {
        setExpandedSystems((current) => ({
            ...current,
            [groupKey]: !(current[groupKey] ?? true),
        }));
    }

    function markCharacterVisibleDone(characterId: string) {
        const visibleCharacterTasks = renderableTasks.filter((item) => item.character?.id === characterId && !item.isComplete);

        setCompletions((current) => {
            const existingKeys = new Set(current.map((item) => item.key));
            const additions: CompletionRecord[] = [];

            for (const item of visibleCharacterTasks) {
                if (!existingKeys.has(item.completionKey)) {
                    additions.push({
                        key: item.completionKey,
                        taskId: item.task.id,
                        characterId: item.character?.id ?? null,
                        periodKey: currentPeriodKey,
                        completedAt: new Date().toISOString(),
                    });
                }
            }

            return [...current, ...additions];
        });
    }

    return (
        <div style={styles.app}>
            <div style={styles.layout}>
                <aside style={styles.sidebar}>
                    <div style={styles.panel}>
                        <div style={styles.titleRow}>
                            <h1 style={styles.h1}>IdleOn Checklist</h1>
                            <span style={styles.versionBadge}>v1</span>
                        </div>
                        <p style={styles.muted}>
                            Interactive starter app with world filters, recurrence tabs, and character-specific tasks.
                        </p>
                    </div>

                    <div style={styles.panel}>
                        <SectionTitle>Frequency</SectionTitle>
                        <div style={styles.buttonGrid3}>
                            {(['daily', 'weekly', 'monthly'] as Frequency[]).map((item) => (
                                <button key={item} style={buttonStyle(frequency === item)} onClick={() => setFrequency(item)}>
                                    {capitalize(item)}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div style={styles.panel}>
                        <SectionTitle>View</SectionTitle>
                        <div style={styles.buttonGrid2}>
                            <button style={buttonStyle(worldFilter === 'all')} onClick={() => setWorldFilter('all')}>All Tasks</button>
                            <button style={buttonStyle(worldFilter === 'favorites')} onClick={() => setWorldFilter('favorites')}>Favorites</button>
                            <button style={buttonStyle(worldFilter === 'character')} onClick={() => setWorldFilter('character')}>Character</button>
                            <button
                                style={buttonStyle(preferences.hideCompleted)}
                                onClick={() => setPreferences((current) => ({ ...current, hideCompleted: !current.hideCompleted }))}
                            >
                                {preferences.hideCompleted ? 'Hide Completed On' : 'Hide Completed Off'}
                            </button>
                        </div>
                    </div>

                    <div style={styles.panel}>
                        <SectionTitle>Worlds</SectionTitle>
                        <div style={styles.buttonGrid2}>
                            <button style={buttonStyle(worldFilter === 0)} onClick={() => setWorldFilter(0)}>Global</button>
                            {[1, 2, 3, 4, 5, 6, 7].map((world) => (
                                <button key={world} style={buttonStyle(worldFilter === world)} onClick={() => setWorldFilter(world)}>
                                    World {world}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div style={styles.panel}>
                        <div style={styles.sectionHeaderRow}>
                            <SectionTitle>Characters</SectionTitle>
                            <span style={styles.smallBadge}>{enabledCharacters.length}</span>
                        </div>
                        <div style={styles.characterList}>
                            <button style={buttonStyle(selectedCharacterId === 'all')} onClick={() => setSelectedCharacterId('all')}>
                                All Characters
                            </button>
                            {enabledCharacters.map((character) => (
                                <div key={character.id} style={styles.characterRow}>
                                    <button
                                        style={{ ...buttonStyle(selectedCharacterId === character.id), flex: 1 }}
                                        onClick={() => setSelectedCharacterId(character.id)}
                                    >
                                        {character.name}
                                    </button>
                                    <button style={styles.secondaryButton} onClick={() => markCharacterVisibleDone(character.id)} title="Mark visible tasks done">
                                        ✓
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div style={styles.panel}>
                        <div style={styles.actionColumn}>
                            <button style={styles.secondaryButtonWide} onClick={resetCurrentFrequency}>
                                Reset Current {capitalize(frequency)}
                            </button>
                            <button style={styles.secondaryButtonWide} onClick={resetAllData}>
                                Clear All Saved Data
                            </button>
                        </div>
                    </div>
                </aside>

                <main style={styles.main}>
                    <div style={styles.topCards}>
                        <div style={styles.panel}>
                            <div style={styles.summaryRow}>
                                <div>
                                    <div style={styles.summaryTitle}>{capitalize(frequency)} Run</div>
                                    <div style={styles.muted}>
                                        {stats.completed} / {stats.total} complete · {stats.remaining} remaining · {stats.percent}% done
                                    </div>
                                </div>
                                <div style={styles.progressTrack}>
                                    <div style={{ ...styles.progressFill, width: `${stats.percent}%` }} />
                                </div>
                            </div>
                        </div>

                        <div style={styles.panelSmall}>
                            <div style={styles.centerText}>
                                {worldFilter === 'all' ? 'All views' : typeof worldFilter === 'number' ? worldLabel(worldFilter) : capitalize(String(worldFilter))}
                            </div>
                        </div>
                    </div>

                    <div style={styles.panel}>
                        <div style={styles.searchRow}>
                            <input
                                value={search}
                                onChange={(event) => setSearch(event.target.value)}
                                placeholder="Search task, world, system, tag, or character..."
                                style={styles.input}
                            />
                            <button style={styles.secondaryButtonWide} onClick={() => setShowOptional((current) => !current)}>
                                {showOptional ? 'Optional On' : 'Optional Off'}
                            </button>
                        </div>

                        <div style={styles.taskContainer}>
                            {groupedTasks.length === 0 && (
                                <div style={styles.emptyState}>No tasks match the current filters.</div>
                            )}

                            {groupedTasks.map((group) => {
                                const isExpanded = expandedSystems[group.key] ?? true;
                                return (
                                    <div key={group.key} style={styles.groupCard}>
                                        <div style={styles.groupHeader}>
                                            <div>
                                                <div style={styles.groupTitle}>{group.system}</div>
                                                <div style={styles.groupMeta}>{worldLabel(group.world)} · {group.completed}/{group.total} complete</div>
                                            </div>
                                            <div style={styles.groupHeaderActions}>
                                                <span style={styles.smallBadge}>{group.total}</span>
                                                <button style={styles.iconButton} onClick={() => toggleSystem(group.key)} type="button">
                                                    {isExpanded ? 'Collapse' : 'Expand'}
                                                </button>
                                            </div>
                                        </div>

                                        {isExpanded && (
                                            <div style={styles.groupContent}>
                                                {group.items.map((item) => {
                                                    const isFavorite = preferences.favoriteTaskIds.includes(item.task.id);

                                                    return (
                                                        <div key={item.renderKey} style={item.isComplete ? styles.taskDone : styles.taskCard}>
                                                            <div style={styles.rowLeft}>
                                                                <input
                                                                    type="checkbox"
                                                                    checked={item.isComplete}
                                                                    onChange={() => toggleTask(item)}
                                                                    style={styles.checkbox}
                                                                />
                                                                <div style={styles.rowContent}>
                                                                    <div style={styles.rowTop}>
                                                                        <div style={{ ...styles.taskTitle, ...(item.isComplete ? styles.taskTitleDone : {}) }}>
                                                                            {item.task.title}
                                                                        </div>
                                                                        <div style={styles.inlineBadges}>
                                                                            <span style={styles.categoryBadge}>{item.task.category}</span>
                                                                            <span style={priorityBadgeStyle(item.task.priority)}>{capitalize(item.task.priority)}</span>
                                                                            {item.task.optional && <span style={styles.optionalBadge}>Optional</span>}
                                                                        </div>
                                                                    </div>
                                                                    <div style={styles.taskMetaCompact}>
                                                                        {item.character ? `${item.character.name} · ${item.character.classGroup}` : 'Account-wide'}
                                                                        {' · '}
                                                                        {worldLabel(item.task.world)}
                                                                        {' · '}
                                                                        {item.task.system}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                            <div style={styles.taskActionsInline}>
                                                                <button style={styles.iconButton} onClick={() => toggleFavorite(item.task.id)} type="button">
                                                                    {isFavorite ? '★' : '☆'}
                                                                </button>
                                                                <button style={styles.iconButton} onClick={() => hideTask(item.task.id)} type="button">
                                                                    Hide
                                                                </button>
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </main>
            </div>
        </div>
    );
}

const styles: Record<string, React.CSSProperties> = {
    app: {
        minHeight: '100vh',
        background: '#020617',
        color: '#e2e8f0',
        fontFamily: 'Inter, ui-sans-serif, system-ui, sans-serif',
    },
    layout: {
        maxWidth: '1400px',
        margin: '0 auto',
        padding: '10px',
        display: 'grid',
        gridTemplateColumns: '300px 1fr',
        gap: '12px',
    },
    sidebar: {
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
    },
    main: {
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
    },
    panel: {
        background: '#0f172a',
        border: '1px solid #1e293b',
        borderRadius: '16px',
        padding: '14px',
        boxShadow: '0 10px 24px rgba(0, 0, 0, 0.22)',
    },
    panelSmall: {
        background: '#0f172a',
        border: '1px solid #1e293b',
        borderRadius: '16px',
        padding: '14px',
        minWidth: '180px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
    },
    titleRow: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '12px',
    },
    h1: {
        margin: 0,
        fontSize: '22px',
        lineHeight: 1.2,
    },
    versionBadge: {
        background: 'rgba(99, 102, 241, 0.2)',
        color: '#c7d2fe',
        borderRadius: '999px',
        padding: '4px 10px',
        fontSize: '12px',
        fontWeight: 700,
    },
    muted: {
        color: '#94a3b8',
        fontSize: '13px',
        lineHeight: 1.45,
    },
    sectionTitle: {
        fontSize: '12px',
        fontWeight: 700,
        textTransform: 'uppercase',
        letterSpacing: '0.18em',
        color: '#64748b',
        marginBottom: '8px',
    },
    buttonGrid2: {
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: '8px',
    },
    buttonGrid3: {
        display: 'grid',
        gridTemplateColumns: '1fr 1fr 1fr',
        gap: '8px',
    },
    button: {
        background: '#1e293b',
        color: '#e2e8f0',
        border: '1px solid #334155',
        borderRadius: '12px',
        padding: '9px 10px',
        cursor: 'pointer',
        fontSize: '13px',
        fontWeight: 600,
    },
    buttonActive: {
        background: '#4f46e5',
        borderColor: '#4f46e5',
    },
    secondaryButton: {
        background: '#111827',
        color: '#e2e8f0',
        border: '1px solid #334155',
        borderRadius: '12px',
        padding: '9px 10px',
        cursor: 'pointer',
        fontSize: '13px',
        fontWeight: 600,
    },
    secondaryButtonWide: {
        background: '#111827',
        color: '#e2e8f0',
        border: '1px solid #334155',
        borderRadius: '12px',
        padding: '9px 10px',
        cursor: 'pointer',
        fontSize: '13px',
        fontWeight: 600,
        width: '100%',
    },
    sectionHeaderRow: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    smallBadge: {
        background: '#1e293b',
        color: '#cbd5e1',
        borderRadius: '999px',
        padding: '4px 9px',
        fontSize: '12px',
        fontWeight: 700,
    },
    characterList: {
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
    },
    characterRow: {
        display: 'flex',
        gap: '8px',
    },
    actionColumn: {
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
    },
    topCards: {
        display: 'grid',
        gridTemplateColumns: '1fr 180px',
        gap: '10px',
    },
    summaryRow: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: '14px',
    },
    summaryTitle: {
        fontSize: '20px',
        fontWeight: 700,
        lineHeight: 1.2,
    },
    progressTrack: {
        width: '260px',
        height: '10px',
        background: '#1e293b',
        borderRadius: '999px',
        overflow: 'hidden',
        flexShrink: 0,
    },
    progressFill: {
        height: '100%',
        background: '#6366f1',
        borderRadius: '999px',
    },
    centerText: {
        textAlign: 'center',
        color: '#cbd5e1',
        fontWeight: 600,
    },
    searchRow: {
        display: 'grid',
        gridTemplateColumns: '1fr 180px',
        gap: '10px',
        marginBottom: '12px',
    },
    input: {
        width: '100%',
        background: '#020617',
        color: '#e2e8f0',
        border: '1px solid #334155',
        borderRadius: '12px',
        padding: '10px 12px',
        fontSize: '14px',
        boxSizing: 'border-box',
    },
    taskContainer: {
        maxHeight: '76vh',
        overflowY: 'auto',
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
        paddingRight: '4px',
    },
    emptyState: {
        minHeight: '160px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        border: '1px dashed #334155',
        borderRadius: '16px',
        color: '#94a3b8',
        background: '#020617',
    },
    groupCard: {
        border: '1px solid #1e293b',
        borderRadius: '14px',
        overflow: 'hidden',
        background: '#020617',
    },
    groupHeader: {
        background: '#0f172a',
        color: '#e2e8f0',
        borderBottom: '1px solid #1e293b',
        padding: '10px 14px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: '10px',
    },
    groupHeaderActions: {
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
    },
    groupTitle: {
        fontWeight: 700,
        fontSize: '14px',
    },
    groupMeta: {
        color: '#94a3b8',
        fontSize: '12px',
        marginTop: '3px',
    },
    groupContent: {
        padding: 0,
        display: 'flex',
        flexDirection: 'column',
    },
    taskCard: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: '12px',
        padding: '10px 14px',
        borderBottom: '1px solid #1e293b',
        background: 'transparent',
    },
    taskDone: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: '12px',
        padding: '10px 14px',
        borderBottom: '1px solid #1e293b',
        background: 'rgba(16, 185, 129, 0.08)',
    },
    rowLeft: {
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        minWidth: 0,
        flex: 1,
    },
    rowContent: {
        minWidth: 0,
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        gap: '4px',
    },
    rowTop: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '12px',
    },
    checkbox: {
        width: '16px',
        height: '16px',
        cursor: 'pointer',
        flexShrink: 0,
    },
    taskTitle: {
        fontSize: '14px',
        fontWeight: 700,
        color: '#f8fafc',
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
    },
    taskTitleDone: {
        textDecoration: 'line-through',
        color: '#bbf7d0',
    },
    inlineBadges: {
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        flexShrink: 0,
    },
    categoryBadge: {
        background: '#1e293b',
        color: '#cbd5e1',
        borderRadius: '999px',
        padding: '3px 8px',
        fontSize: '11px',
        fontWeight: 700,
    },
    priorityHigh: {
        background: 'rgba(244, 63, 94, 0.18)',
        color: '#fecdd3',
        borderRadius: '999px',
        padding: '3px 8px',
        fontSize: '11px',
        fontWeight: 700,
    },
    priorityMedium: {
        background: 'rgba(56, 189, 248, 0.18)',
        color: '#bae6fd',
        borderRadius: '999px',
        padding: '3px 8px',
        fontSize: '11px',
        fontWeight: 700,
    },
    priorityLow: {
        background: '#334155',
        color: '#cbd5e1',
        borderRadius: '999px',
        padding: '3px 8px',
        fontSize: '11px',
        fontWeight: 700,
    },
    optionalBadge: {
        background: 'rgba(245, 158, 11, 0.18)',
        color: '#fde68a',
        borderRadius: '999px',
        padding: '3px 8px',
        fontSize: '11px',
        fontWeight: 700,
    },
    taskMetaCompact: {
        color: '#94a3b8',
        fontSize: '12px',
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
    },
    taskActionsInline: {
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        flexShrink: 0,
    },
    iconButton: {
        background: '#111827',
        color: '#cbd5e1',
        border: '1px solid #334155',
        borderRadius: '10px',
        padding: '7px 10px',
        cursor: 'pointer',
        fontSize: '12px',
        fontWeight: 700,
    },
};

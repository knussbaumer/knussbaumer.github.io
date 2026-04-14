import React, { useEffect, useMemo, useState } from 'react';
import {
    charactersSeed,
    tasksSeed,
    type CharacterProfile,
    type ClassGroup,
    type CompletionRecord,
    type Frequency,
    type Preferences,
    type Priority,
    type TaskDefinition,
    type WorldFilter,
} from './tasks';

type TaskGroupName =
    | 'Class Specifics'
    | 'Global'
    | 'World 1'
    | 'World 2'
    | 'World 3'
    | 'World 4'
    | 'World 5'
    | 'World 6'
    | 'World 7';

type RenderableTask = {
    renderKey: string;
    task: TaskDefinition;
    character: CharacterProfile | null;
    isComplete: boolean;
    completionKey: string;
    groupName: TaskGroupName;
};

type GroupedTasks = {
    key: TaskGroupName;
    title: TaskGroupName;
    items: RenderableTask[];
    completed: number;
    total: number;
};

type HiddenTaskEntry = {
    key: string;
    label: string;
    frequency: Frequency;
};

type StoredPreferences = Partial<Preferences> & {
    hiddenTaskIds?: string[];
};

const STORAGE_KEYS = {
    completions: 'idleon-checklist-v1-completions',
    preferences: 'idleon-checklist-v1-preferences',
    characters: 'idleon-checklist-v2-characters',
};

const GROUP_ORDER: TaskGroupName[] = [
    'Class Specifics',
    'Global',
    'World 1',
    'World 2',
    'World 3',
    'World 4',
    'World 5',
    'World 6',
    'World 7',
];

function getPeriodKey(frequency: Frequency): string {
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

    const monday = new Date(now);
    const currentDay = monday.getDay();
    const distanceFromMonday = (currentDay + 6) % 7;
    monday.setDate(monday.getDate() - distanceFromMonday);

    const weekYear = monday.getFullYear();
    const weekMonth = String(monday.getMonth() + 1).padStart(2, '0');
    const weekDay = String(monday.getDate()).padStart(2, '0');

    return `${weekYear}-${weekMonth}-${weekDay}`;
}

function buildCompletionKey(taskId: string, characterId: string | null, periodKey: string): string {
    return `${taskId}::${characterId ?? 'account'}::${periodKey}`;
}

function buildVisibilityKey(taskId: string, characterId: string | null): string {
    return `${taskId}::${characterId ?? 'account'}`;
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

function saveJson<T>(key: string, value: T): void {
    if (typeof window === 'undefined') {
        return;
    }

    window.localStorage.setItem(key, JSON.stringify(value));
}

function normalizePreferences(value: StoredPreferences | undefined): Preferences {
    return {
        hiddenTaskKeys: Array.isArray(value?.hiddenTaskKeys)
            ? value.hiddenTaskKeys
            : Array.isArray(value?.hiddenTaskIds)
                ? value.hiddenTaskIds
                : [],
        favoriteTaskIds: Array.isArray(value?.favoriteTaskIds) ? value.favoriteTaskIds : [],
        hideCompleted: typeof value?.hideCompleted === 'boolean' ? value.hideCompleted : false,
    };
}

function normalizeCharacters(value: unknown): CharacterProfile[] {
    if (!Array.isArray(value)) {
        return charactersSeed;
    }

    return value.map((item, index) => {
        const character = item as Partial<CharacterProfile> & { classGroup?: ClassGroup[] | ClassGroup | string };

        const rawClassGroup = character.classGroup;
        const classGroup = Array.isArray(rawClassGroup)
            ? (rawClassGroup as ClassGroup[])
            : typeof rawClassGroup === 'string'
                ? [rawClassGroup as ClassGroup]
                : [];

        return {
            id: typeof character.id === 'string' ? character.id : `char-${index + 1}`,
            name: typeof character.name === 'string' ? character.name : `Character ${index + 1}`,
            classGroup,
            enabled: typeof character.enabled === 'boolean' ? character.enabled : true,
            sortOrder: typeof character.sortOrder === 'number' ? character.sortOrder : index + 1,
        };
    });
}

function capitalize(value: string): string {
    return value.charAt(0).toUpperCase() + value.slice(1);
}

function getTaskGroupName(task: TaskDefinition): TaskGroupName {
    if (task.scope === 'character') {
        return 'Class Specifics';
    }

    if (task.world === 0) {
        return 'Global';
    }

    return `World ${task.world}` as TaskGroupName;
}

function buttonStyle(active: boolean): React.CSSProperties {
    return {
        ...styles.button,
        ...(active ? styles.buttonActive : {}),
    };
}

function priorityDotStyle(priority: Priority): React.CSSProperties {
    if (priority === 'high') {
        return { ...styles.priorityDot, background: '#f43f5e' };
    }

    if (priority === 'medium') {
        return { ...styles.priorityDot, background: '#38bdf8' };
    }

    return { ...styles.priorityDot, background: '#94a3b8' };
}

function SectionTitle({ children }: { children: React.ReactNode }) {
    return <div style={styles.sectionTitle}>{children}</div>;
}

export default function App() {
    const [frequency, setFrequency] = useState<Frequency>('daily');
    const [worldFilter, setWorldFilter] = useState<WorldFilter>('all');
    const [search, setSearch] = useState('');
    const [showOptional, setShowOptional] = useState(true);
    const [selectedCharacterId, setSelectedCharacterId] = useState<string>('all');
    const [priorityFilter, setPriorityFilter] = useState<'all' | Priority>('all');

    const [characters, setCharacters] = useState<CharacterProfile[]>(
        () => normalizeCharacters(loadJson<unknown>(STORAGE_KEYS.characters, charactersSeed)),
    );

    const [completions, setCompletions] = useState<CompletionRecord[]>(
        () => loadJson<CompletionRecord[]>(STORAGE_KEYS.completions, []),
    );

    const [preferences, setPreferences] = useState<Preferences>(
        () =>
            normalizePreferences(
                loadJson<StoredPreferences>(STORAGE_KEYS.preferences, {
                    hiddenTaskKeys: [],
                    favoriteTaskIds: [],
                    hideCompleted: false,
                }),
            ),
    );

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

            if (!showOptional && task.optional) {
                continue;
            }

            if (priorityFilter !== 'all' && task.priority !== priorityFilter) {
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

            const matchesSearch = [task.title, task.description ?? '']
                .join(' ')
                .toLowerCase()
                .includes(search.toLowerCase());

            if (!matchesSearch) {
                continue;
            }

            const groupName = getTaskGroupName(task);

            if (task.scope === 'account') {
                const visibilityKey = buildVisibilityKey(task.id, null);

                if (preferences.hiddenTaskKeys.includes(visibilityKey)) {
                    continue;
                }

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
                    groupName,
                });

                continue;
            }

            for (const character of enabledCharacters) {
                const selectedMatches = selectedCharacterId === 'all' || selectedCharacterId === character.id;
                if (!selectedMatches) {
                    continue;
                }

                const requiredClasses = task.requiresClasses ?? [];
                const classAllowed =
                    requiredClasses.length === 0 ||
                    character.classGroup.some((className) => requiredClasses.includes(className));

                if (!classAllowed) {
                    continue;
                }

                const visibilityKey = buildVisibilityKey(task.id, character.id);

                if (preferences.hiddenTaskKeys.includes(visibilityKey)) {
                    continue;
                }

                const completionKey = buildCompletionKey(task.id, character.id, currentPeriodKey);
                const isComplete = completionSet.has(completionKey);

                if (preferences.hideCompleted && isComplete) {
                    continue;
                }

                const characterSearchMatches = `${task.title} ${character.name} ${character.classGroup.join(' ')}`
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
                    groupName,
                });
            }
        }

        return entries.sort((a, b) => {
            const groupDelta = GROUP_ORDER.indexOf(a.groupName) - GROUP_ORDER.indexOf(b.groupName);
            if (groupDelta !== 0) {
                return groupDelta;
            }

            const titleDelta = a.task.title.localeCompare(b.task.title);
            if (titleDelta !== 0) {
                return titleDelta;
            }

            const aCharacter = a.character?.name ?? '';
            const bCharacter = b.character?.name ?? '';
            return aCharacter.localeCompare(bCharacter);
        });
    }, [
        completionSet,
        currentPeriodKey,
        enabledCharacters,
        frequency,
        preferences.favoriteTaskIds,
        preferences.hiddenTaskKeys,
        preferences.hideCompleted,
        priorityFilter,
        search,
        selectedCharacterId,
        showOptional,
        worldFilter,
    ]);

    const groupedTasks = useMemo<GroupedTasks[]>(() => {
        const groups = new Map<TaskGroupName, RenderableTask[]>();

        for (const item of renderableTasks) {
            const existing = groups.get(item.groupName) ?? [];
            existing.push(item);
            groups.set(item.groupName, existing);
        }

        return GROUP_ORDER
            .map((groupName) => {
                const items = groups.get(groupName) ?? [];

                if (items.length === 0) {
                    return null;
                }

                const completed = items.filter((item) => item.isComplete).length;

                return {
                    key: groupName,
                    title: groupName,
                    items,
                    completed,
                    total: items.length,
                };
            })
            .filter((group): group is GroupedTasks => group !== null);
    }, [renderableTasks]);

    const hiddenTaskEntries = useMemo<HiddenTaskEntry[]>(() => {
        return preferences.hiddenTaskKeys
            .map((key) => {
                const [taskId, rawCharacterId] = key.split('::');
                const characterId = rawCharacterId === 'account' ? null : rawCharacterId;

                const task = tasksSeed.find((item) => item.id === taskId);
                const character = characterId
                    ? characters.find((item) => item.id === characterId) ??
                      charactersSeed.find((item) => item.id === characterId) ??
                      null
                    : null;

                if (!task) {
                    return {
                        key,
                        label: taskId,
                        frequency: 'daily' as Frequency,
                    };
                }

                return {
                    key,
                    label: character ? `${task.title} — ${character.name}` : task.title,
                    frequency: task.frequency,
                };
            })
            .sort((a, b) => a.label.localeCompare(b.label));
    }, [characters, preferences.hiddenTaskKeys]);

    const stats = useMemo(() => {
        const total = renderableTasks.length;
        const completed = renderableTasks.filter((task) => task.isComplete).length;
        const remaining = total - completed;
        const percent = total === 0 ? 0 : Math.round((completed / total) * 100);

        return {
            total,
            completed,
            remaining,
            percent,
        };
    }, [renderableTasks]);

    function toggleTask(item: RenderableTask): void {
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

    function toggleFavorite(taskId: string): void {
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

    function hideTask(taskId: string, characterId: string | null): void {
        const visibilityKey = buildVisibilityKey(taskId, characterId);

        setPreferences((current) => {
            if (current.hiddenTaskKeys.includes(visibilityKey)) {
                return current;
            }

            return {
                ...current,
                hiddenTaskKeys: [...current.hiddenTaskKeys, visibilityKey],
            };
        });
    }

    function unhideTask(visibilityKey: string): void {
        setPreferences((current) => ({
            ...current,
            hiddenTaskKeys: current.hiddenTaskKeys.filter((key) => key !== visibilityKey),
        }));
    }

    function resetCurrentFrequency(): void {
        setCompletions((current) => current.filter((record) => record.periodKey !== currentPeriodKey));
    }

    function resetAllData(): void {
        setCompletions([]);
        setPreferences({
            hiddenTaskKeys: [],
            favoriteTaskIds: [],
            hideCompleted: false,
        });
        setCharacters(charactersSeed);
    }

    function markCharacterVisibleDone(characterId: string): void {
        const visibleCharacterTasks = renderableTasks.filter(
            (item) => item.character?.id === characterId && !item.isComplete,
        );

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
                                <button
                                    key={item}
                                    style={buttonStyle(frequency === item)}
                                    onClick={() => setFrequency(item)}
                                    type="button"
                                >
                                    {capitalize(item)}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div style={styles.panel}>
                        <SectionTitle>View</SectionTitle>
                        <div style={styles.buttonGrid2}>
                            <button style={buttonStyle(worldFilter === 'all')} onClick={() => setWorldFilter('all')} type="button">
                                All Tasks
                            </button>
                            <button
                                style={buttonStyle(worldFilter === 'favorites')}
                                onClick={() => setWorldFilter('favorites')}
                                type="button"
                            >
                                Favorites
                            </button>
                            <button
                                style={buttonStyle(worldFilter === 'character')}
                                onClick={() => setWorldFilter('character')}
                                type="button"
                            >
                                Character
                            </button>
                            <button
                                style={buttonStyle(preferences.hideCompleted)}
                                onClick={() =>
                                    setPreferences((current) => ({
                                        ...current,
                                        hideCompleted: !current.hideCompleted,
                                    }))
                                }
                                type="button"
                            >
                                {preferences.hideCompleted ? 'Hide Completed On' : 'Hide Completed Off'}
                            </button>
                        </div>
                    </div>

                    <div style={styles.panel}>
                        <SectionTitle>Priority</SectionTitle>
                        <div style={styles.buttonGrid2}>
                            <button style={buttonStyle(priorityFilter === 'all')} onClick={() => setPriorityFilter('all')} type="button">
                                All
                            </button>
                            <button style={buttonStyle(priorityFilter === 'high')} onClick={() => setPriorityFilter('high')} type="button">
                                High
                            </button>
                            <button style={buttonStyle(priorityFilter === 'medium')} onClick={() => setPriorityFilter('medium')} type="button">
                                Medium
                            </button>
                            <button style={buttonStyle(priorityFilter === 'low')} onClick={() => setPriorityFilter('low')} type="button">
                                Low
                            </button>
                        </div>
                    </div>

                    <div style={styles.panel}>
                        <SectionTitle>Worlds</SectionTitle>
                        <div style={styles.buttonGrid2}>
                            <button style={buttonStyle(worldFilter === 0)} onClick={() => setWorldFilter(0)} type="button">
                                Global
                            </button>
                            {[1, 2, 3, 4, 5, 6, 7].map((world) => (
                                <button
                                    key={world}
                                    style={buttonStyle(worldFilter === world)}
                                    onClick={() => setWorldFilter(world)}
                                    type="button"
                                >
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
                            <button
                                style={buttonStyle(selectedCharacterId === 'all')}
                                onClick={() => setSelectedCharacterId('all')}
                                type="button"
                            >
                                All Characters
                            </button>

                            {enabledCharacters.map((character) => (
                                <div key={character.id} style={styles.characterRow}>
                                    <button
                                        style={{ ...buttonStyle(selectedCharacterId === character.id), flex: 1 }}
                                        onClick={() => setSelectedCharacterId(character.id)}
                                        type="button"
                                    >
                                        {character.name}
                                    </button>
                                    <button
                                        style={styles.secondaryButton}
                                        onClick={() => markCharacterVisibleDone(character.id)}
                                        title="Mark visible tasks done"
                                        type="button"
                                    >
                                        ✓
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div style={styles.panel}>
                        <div style={styles.sectionHeaderRow}>
                            <SectionTitle>Hidden Tasks</SectionTitle>
                            <span style={styles.smallBadge}>{hiddenTaskEntries.length}</span>
                        </div>

                        {hiddenTaskEntries.length === 0 ? (
                            <div style={styles.muted}>No hidden tasks.</div>
                        ) : (
                            <div style={styles.hiddenList}>
                                {hiddenTaskEntries.map((item) => (
                                    <div key={item.key} style={styles.hiddenRow}>
                                        <div style={styles.hiddenTaskTextWrap}>
                                            <div style={styles.hiddenTaskLabel}>{item.label}</div>
                                            <div style={styles.hiddenTaskMeta}>{capitalize(item.frequency)}</div>
                                        </div>
                                        <button
                                            style={styles.unhideButton}
                                            onClick={() => unhideTask(item.key)}
                                            type="button"
                                        >
                                            Unhide
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    <div style={styles.panel}>
                        <div style={styles.actionColumn}>
                            <button style={styles.secondaryButtonWide} onClick={resetCurrentFrequency} type="button">
                                Reset Current {capitalize(frequency)}
                            </button>
                            <button style={styles.secondaryButtonWide} onClick={resetAllData} type="button">
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
                                {worldFilter === 'all'
                                    ? 'All views'
                                    : typeof worldFilter === 'number'
                                        ? `World ${worldFilter}`
                                        : capitalize(String(worldFilter))}
                            </div>
                        </div>
                    </div>

                    <div style={styles.panel}>
                        <div style={styles.searchRow}>
                            <input
                                value={search}
                                onChange={(event) => setSearch(event.target.value)}
                                placeholder="Search task or description..."
                                style={styles.input}
                            />
                            <button
                                style={styles.secondaryButtonWide}
                                onClick={() => setShowOptional((current) => !current)}
                                type="button"
                            >
                                {showOptional ? 'Optional On' : 'Optional Off'}
                            </button>
                        </div>

                        <div style={styles.taskContainer}>
                            {groupedTasks.length === 0 && (
                                <div style={styles.emptyState}>No tasks match the current filters.</div>
                            )}

                            {groupedTasks.map((group) => (
                                <div key={group.key} style={styles.groupBlock}>
                                    <div style={styles.groupHeader}>
                                        <div>
                                            <div style={styles.groupTitle}>{group.title}</div>
                                            <div style={styles.groupMeta}>
                                                {group.completed}/{group.total} complete
                                            </div>
                                        </div>
                                        <span style={styles.smallBadge}>{group.total}</span>
                                    </div>

                                    <div style={styles.rows}>
                                        {group.items.map((item) => {
                                            const isFavorite = preferences.favoriteTaskIds.includes(item.task.id);

                                            return (
                                                <div
                                                    key={item.renderKey}
                                                    style={item.isComplete ? styles.taskDone : styles.taskRow}
                                                >
                                                    <label style={styles.taskMain}>
                                                        <input
                                                            type="checkbox"
                                                            checked={item.isComplete}
                                                            onChange={() => toggleTask(item)}
                                                            style={styles.checkbox}
                                                        />
                                                        <div style={styles.taskTextWrap}>
                                                            <div style={styles.taskTitleRow}>
                                                                <span
                                                                    style={priorityDotStyle(item.task.priority)}
                                                                    title={`Priority: ${capitalize(item.task.priority)}`}
                                                                />
                                                                <div
                                                                    style={{
                                                                        ...styles.taskTitle,
                                                                        ...(item.isComplete ? styles.taskTitleDone : {}),
                                                                    }}
                                                                >
                                                                    {item.task.title}
                                                                </div>
                                                                {item.task.optional && (
                                                                    <span style={styles.optionalBadge}>Optional</span>
                                                                )}
                                                            </div>
                                                            {item.task.description && (
                                                                <div style={styles.taskDescription}>
                                                                    {item.task.description}
                                                                </div>
                                                            )}
                                                        </div>
                                                    </label>

                                                    <div style={styles.taskRight}>
                                                        <button
                                                            style={styles.iconButton}
                                                            onClick={() => toggleFavorite(item.task.id)}
                                                            type="button"
                                                        >
                                                            {isFavorite ? '★' : '☆'}
                                                        </button>
                                                        <button
                                                            style={styles.iconButton}
                                                            onClick={() => hideTask(item.task.id, item.character?.id ?? null)}
                                                            type="button"
                                                        >
                                                            Hide
                                                        </button>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            ))}
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
        flexShrink: 0,
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
        gap: '12px',
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
    groupBlock: {
        borderBottom: '1px solid #1e293b',
        paddingBottom: '6px',
    },
    groupHeader: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: '10px',
        padding: '4px 0 8px 0',
    },
    groupTitle: {
        fontWeight: 700,
        fontSize: '14px',
    },
    groupMeta: {
        color: '#94a3b8',
        fontSize: '12px',
        marginTop: '2px',
    },
    rows: {
        display: 'flex',
        flexDirection: 'column',
    },
    taskRow: {
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 1fr) auto',
        alignItems: 'center',
        gap: '8px',
        padding: '8px 0',
        borderTop: '1px solid rgba(30, 41, 59, 0.7)',
        background: 'transparent',
    },
    taskDone: {
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 1fr) auto',
        alignItems: 'center',
        gap: '8px',
        padding: '8px 0',
        borderTop: '1px solid rgba(30, 41, 59, 0.7)',
        background: 'transparent',
        opacity: 0.8,
    },
    taskMain: {
        display: 'flex',
        alignItems: 'flex-start',
        gap: '10px',
        minWidth: 0,
    },
    checkbox: {
        width: '16px',
        height: '16px',
        margin: '2px 0 0 0',
        cursor: 'pointer',
        flexShrink: 0,
        accentColor: '#4f46e5',
    },
    taskTextWrap: {
        minWidth: 0,
        display: 'flex',
        flexDirection: 'column',
        gap: '4px',
    },
    taskTitleRow: {
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        flexWrap: 'wrap',
        minWidth: 0,
    },
    taskTitle: {
        fontSize: '13px',
        fontWeight: 700,
        color: '#f8fafc',
        lineHeight: 1.2,
    },
    taskTitleDone: {
        textDecoration: 'line-through',
        color: '#94a3b8',
    },
    taskDescription: {
        color: '#cbd5e1',
        fontSize: '11px',
        lineHeight: 1.35,
    },
    taskRight: {
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        flexShrink: 0,
    },
    iconButton: {
        background: '#111827',
        color: '#cbd5e1',
        border: '1px solid #334155',
        borderRadius: '8px',
        padding: '5px 8px',
        cursor: 'pointer',
        fontSize: '11px',
        fontWeight: 700,
        lineHeight: 1.2,
        whiteSpace: 'nowrap',
    },
    priorityDot: {
        width: '8px',
        height: '8px',
        borderRadius: '999px',
        flexShrink: 0,
        marginTop: '1px',
    },
    optionalBadge: {
        background: 'rgba(245, 158, 11, 0.18)',
        color: '#fde68a',
        border: '1px solid rgba(245, 158, 11, 0.35)',
        borderRadius: '999px',
        padding: '2px 7px',
        fontSize: '10px',
        fontWeight: 700,
        lineHeight: 1.2,
    },
    hiddenList: {
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        maxHeight: '220px',
        overflowY: 'auto',
        paddingRight: '4px',
    },
    hiddenRow: {
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 1fr) auto',
        gap: '8px',
        alignItems: 'center',
        border: '1px solid #1e293b',
        borderRadius: '12px',
        padding: '8px 10px',
        background: '#111827',
    },
    hiddenTaskTextWrap: {
        minWidth: 0,
        display: 'flex',
        flexDirection: 'column',
        gap: '2px',
    },
    hiddenTaskLabel: {
        fontSize: '12px',
        color: '#e2e8f0',
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
    },
    hiddenTaskMeta: {
        fontSize: '10px',
        color: '#94a3b8',
    },
    unhideButton: {
        background: '#1e293b',
        color: '#e2e8f0',
        border: '1px solid #334155',
        borderRadius: '8px',
        padding: '5px 8px',
        cursor: 'pointer',
        fontSize: '11px',
        fontWeight: 700,
        whiteSpace: 'nowrap',
    },
};
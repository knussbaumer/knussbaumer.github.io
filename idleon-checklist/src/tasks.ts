export type Frequency = 'daily' | 'weekly' | 'monthly';
export type Scope = 'account' | 'character';
export type Priority = 'low' | 'medium' | 'high';
export type ClassGroup =
    | 'beginner'
    | 'warrior'
    | 'mage'
    | 'archer'
    | 'journeyman'
    | 'maestro'
    | 'voidwalker'
    | 'squire'
    | 'divine-knight'
    | 'custom';

export type WorldFilter = 'all' | 'favorites' | 'character' | number;

export type TaskDefinition = {
    id: string;
    title: string;
    description?: string;
    world: number | 0;
    frequency: Frequency;
    scope: Scope;
    priority: Priority;
    requiresClasses?: ClassGroup[];
    optional?: boolean;
};

export type CharacterProfile = {
    id: string;
    name: string;
    classGroup: ClassGroup;
    enabled: boolean;
    sortOrder: number;
};

export type CompletionRecord = {
    key: string;
    taskId: string;
    characterId: string | null;
    periodKey: string;
    completedAt: string;
};

export type Preferences = {
    hiddenTaskKeys: string[];
    favoriteTaskIds: string[];
    hideCompleted: boolean;
};

export const charactersSeed: CharacterProfile[] = [
    { id: 'char-1', name: 'Main DK', classGroup: 'divine-knight', enabled: true, sortOrder: 1 },
    { id: 'char-2', name: 'Voidwalker', classGroup: 'voidwalker', enabled: true, sortOrder: 2 },
    { id: 'char-3', name: 'Maestro', classGroup: 'maestro', enabled: true, sortOrder: 3 },
    { id: 'char-4', name: 'Squire', classGroup: 'squire', enabled: true, sortOrder: 4 },
];

export const tasksSeed: TaskDefinition[] = [
    {
        id: 'account-daily-merit-tasks',
        title: 'Daily Merit Tasks',
        description: 'Clear the daily merit board chores you care about.',
        world: 0,
        frequency: 'daily',
        scope: 'account',
        priority: 'low',
    },
    {
        id: 'account-guild-daily-gp',
        title: 'Guild Daily GP Tasks',
        description: 'Check and clear daily guild point tasks.',
        world: 0,
        frequency: 'daily',
        scope: 'account',
        priority: 'medium',
    },
    {
        id: 'account-vendor-check',
        title: 'Vendor / Shop Check',
        description: 'Review daily-limited vendor purchases and shop rotations.',
        world: 0,
        frequency: 'daily',
        scope: 'account',
        priority: 'high',
        optional: true,
    },
    {
        id: 'account-weekly-happy-hour',
        title: 'Dungeon Happy Hour',
        description: 'Run your weekly dungeon happy hour sessions.',
        world: 0,
        frequency: 'weekly',
        scope: 'account',
        priority: 'medium',
    },
    {
        id: 'account-monthly-tome-nametags',
        title: 'Claim Tome Nametags',
        description: 'Claim monthly Tome percentile rewards.',
        world: 0,
        frequency: 'monthly',
        scope: 'account',
        priority: 'medium',
    },
    {
        id: 'character-printer-go-brrr',
        title: 'Printer Go Brrr',
        description: 'Use free printer sample hours if available.',
        world: 0,
        frequency: 'daily',
        scope: 'character',
        priority: 'high',
        requiresClasses: ['maestro'],
    },
    {
        id: 'character-its-your-birthday',
        title: "It's Your Birthday!",
        description: 'Use the daily beginner-class perk if relevant.',
        world: 0,
        frequency: 'daily',
        scope: 'character',
        priority: 'medium',
        requiresClasses: ['journeyman'],
    },
    {
        id: 'character-void-trial-rerun',
        title: 'Void Trial Rerun',
        description: 'Rerun your daily Voidwalker speedrun if relevant.',
        world: 0,
        frequency: 'daily',
        scope: 'character',
        priority: 'medium',
        requiresClasses: ['voidwalker'],
    },
    {
        id: 'character-refinery-throttle',
        title: 'Refinery Throttle',
        description: 'Use the daily refinery talent if available.',
        world: 0,
        frequency: 'daily',
        scope: 'character',
        priority: 'medium',
        requiresClasses: ['squire'],
    },
    {
        id: 'w1-smithing-forge-anvil',
        title: 'Smithing Forge and Anvil',
        description: 'Collect and refresh forge/anvil production.',
        world: 1,
        frequency: 'daily',
        scope: 'account',
        priority: 'high',
    },
    {
        id: 'w1-picnic-stowaway',
        title: 'Picnic Stowaway Daily Quest',
        description: 'Do the picnic daily if still useful for you.',
        world: 1,
        frequency: 'daily',
        scope: 'account',
        priority: 'low',
        optional: true,
    },
    {
        id: 'w2-post-office',
        title: 'Post Office Orders',
        description: 'Spend or check your post office boxes.',
        world: 2,
        frequency: 'weekly',
        scope: 'account',
        priority: 'medium',
    },
    {
        id: 'w2-alchemy',
        title: 'Alchemy Bubbles Boron',
        description: 'Spend your Boron/Atom Particles.',
        world: 2,
        frequency: 'daily',
        scope: 'account',
        priority: 'high',
    },
    {
        id: 'w2-killroy',
        title: 'Killroy',
        description: 'Use your weekly Killroy run if you are doing it.',
        world: 2,
        frequency: 'weekly',
        scope: 'account',
        priority: 'medium',
    },
    {
        id: 'w2-weekly-battle',
        title: 'Weekly Boss Battle',
        description: 'Weekly boss battle clear. https://docs.google.com/spreadsheets/d/1z1P2ouvYhe2pryWoF0kIQE7QichYpJt1GaPPos-e-aw',
        world: 2,
        frequency: 'weekly',
        scope: 'account',
        priority: 'medium',
    },
    {
        id: 'w3-construction',
        title: 'Construction Queue Check',
        description: 'Review build queue, cogs, and priorities.',
        world: 3,
        frequency: 'daily',
        scope: 'account',
        priority: 'high',
    },
    {
        id: 'w3-tiny-cogs-jeweled-cogs',
        title: 'Check Daily Tiny and Jeweled Cogs',
        description: 'Check daily Tiny and Jeweled Cogs.',
        world: 3,
        frequency: 'daily',
        scope: 'account',
        priority: 'high',
    },
    {
        id: 'w3-trapping',
        title: 'Trapping Boxes',
        description: 'Collect your traps.',
        world: 3,
        frequency: 'daily',
        scope: 'account',
        priority: 'high',
    },
    {
        id: 'w3-trapping-setup',
        title: 'Trapping Box Setup',
        description: 'Refresh your trapping setup.',
        world: 3,
        frequency: 'monthly',
        scope: 'account',
        priority: 'medium',
    },
    {
        id: 'w3-worship-and-msa',
        title: 'Worship / MSA Charge Check',
        description: 'Weekly charge use.',
        world: 3,
        frequency: 'weekly',
        scope: 'account',
        priority: 'medium',
    },
    {
        id: 'w3-worship-td',
        title: 'Worship TD Check',
        description: 'Monthly Worship tower defense check.',
        world: 3,
        frequency: 'monthly',
        scope: 'account',
        priority: 'medium',
    },
    {
        id: 'w4-breeding-eggs',
        title: 'Breeding Eggs',
        description: 'Collect, hatch, and queue up eggs.',
        world: 4,
        frequency: 'daily',
        scope: 'account',
        priority: 'high',
    },
    {
        id: 'w4-spices',
        title: 'Daily Spice Claims',
        description: 'Daily Spice Claims.',
        world: 4,
        frequency: 'daily',
        scope: 'account',
        priority: 'high',
    },
    {
        id: 'w4-chip-repository',
        title: 'Chip Repository Rotation',
        description: 'Check weekly chip shop rotation.',
        world: 4,
        frequency: 'weekly',
        scope: 'account',
        priority: 'high',
    },
    {
        id: 'w5-sailing',
        title: 'Sailing Ships / Treasures / Captain Shop',
        description: 'Spend treasure, claim loot, and manage captains.',
        world: 5,
        frequency: 'daily',
        scope: 'account',
        priority: 'high',
    },
    {
        id: 'w5-gaming',
        title: 'Gaming Plants / Imports / Upgrades',
        description: 'Review imports and active gaming setup.',
        world: 5,
        frequency: 'daily',
        scope: 'account',
        priority: 'high',
    },
    {
        id: 'w5-divinity-unlinks',
        title: 'Divinity Unlinks / Relinks',
        description: 'Weekly divinity maintenance.',
        world: 5,
        frequency: 'weekly',
        scope: 'account',
        priority: 'medium',
    },
    {
        id: 'w6-farming',
        title: 'Farming Crops / Crossbreeds / Megacrops',
        description: 'Review fields, tickets, and crop progression.',
        world: 6,
        frequency: 'daily',
        scope: 'account',
        priority: 'high',
    },
    {
        id: 'w6-sneaking',
        title: 'Sneaking / Jade / Floors Check',
        description: 'Review sneaking floors, jade, and ninja setup.',
        world: 6,
        frequency: 'daily',
        scope: 'account',
        priority: 'high',
    },
    {
        id: 'w6-familiars',
        title: 'Familiars',
        description: 'Weekly familiar claim/check.',
        world: 6,
        frequency: 'weekly',
        scope: 'account',
        priority: 'high',
    },
    {
        id: 'w7-research',
        title: 'Research Points / Observations / Grid Check',
        description: 'Review observations, points, and the research grid.',
        world: 7,
        frequency: 'daily',
        scope: 'account',
        priority: 'high',
    },
    {
        id: 'w7-minehead',
        title: 'Minehead Check',
        description: 'Review Minehead claims and upgrades.',
        world: 7,
        frequency: 'daily',
        scope: 'account',
        priority: 'medium',
    },
    {
        id: 'w7-sushi-station',
        title: 'Sushi Station Check',
        description: 'Review sushi combines, bucks, and upgrades.',
        world: 7,
        frequency: 'daily',
        scope: 'account',
        priority: 'medium',
    },
    {
        id: 'w7-daily-coral-reef',
        title: 'Daily Coral Reef Check',
        description: 'Review coral reef upgrades.',
        world: 7,
        frequency: 'daily',
        scope: 'account',
        priority: 'medium',
    },
];
/**
 * Central Type Definitions & Entity Contracts
 * Provides IDE autocompletion, static analysis, and runtime validation contracts.
 */

/**
 * @typedef {Object} TypeDefinition
 * @property {string} id
 * @property {string} name
 * @property {string} icon
 */

/**
 * @typedef {Object} ItemExtraInfo
 * @property {string} [number] - Homework or assignment sequence number (e.g. "1")
 * @property {string} [location] - Classroom, hall, or room for events
 * @property {string} [notes] - Markdown notes and checklists
 */

/**
 * @typedef {Object} StudyItem
 * @property {string} id - Unique item identifier
 * @property {'task' | 'event'} kind - Item category
 * @property {string} typeId - Reference to taskTypes or eventTypes config
 * @property {string} typeName - Display name (e.g. "HW", "Quiz", "Project")
 * @property {string} typeIcon - Display icon (Vector SVG or emoji)
 * @property {string} subjectId - Foreign key referencing Subject.id
 * @property {string} title - Task or event title
 * @property {string} dueDate - ISO-8601 deadline/date string
 * @property {boolean} inProgress - Whether item is actively in progress
 * @property {boolean} completed - Whether item is completed
 * @property {ItemExtraInfo} extraInfo - Additional metadata
 * @property {string} createdAt - ISO-8601 creation timestamp
 * @property {string} [deletedAt] - ISO-8601 soft-deletion timestamp if in trash
 */

/**
 * @typedef {Object} Subject
 * @property {string} id - Unique course subject identifier
 * @property {string} title - Course title (e.g. "Fluid Mechanics")
 * @property {string} [code] - Course code (e.g. "ME-301")
 * @property {string} [instructor] - Professor or instructor name
 * @property {string[]} tags - Category and topic tags (e.g. ["Core", "Exam"])
 * @property {boolean} isPinned - Whether course card is pinned to the top
 * @property {number} order - Custom display sort order
 * @property {number} gradientIndex - Index into active color palette gradients
 * @property {string} createdAt - ISO-8601 creation timestamp
 * @property {string} [deletedAt] - ISO-8601 soft-deletion timestamp if in trash
 */

/**
 * @typedef {Object} Material
 * @property {string} id - Unique material identifier
 * @property {string} subjectId - Foreign key referencing Subject.id
 * @property {string} [itemId] - Optional link to a specific StudyItem.id
 * @property {string} name - Display name (e.g. "Lecture Slides")
 * @property {string} filePath - Absolute path to folder on local filesystem
 * @property {string} typeId - Material type identifier ("mat_folder")
 * @property {string} typeName - Display type name ("Course Folder")
 * @property {string} icon - Display icon
 * @property {string} [notes] - Optional folder notes
 * @property {string} createdAt - ISO-8601 creation timestamp
 * @property {string} [deletedAt] - ISO-8601 soft-deletion timestamp if in trash
 */

/**
 * @typedef {Object} TrashContainer
 * @property {Subject[]} subjects
 * @property {StudyItem[]} items
 * @property {Material[]} materials
 */

/**
 * @typedef {Object} FilterOptions
 * @property {'grid' | 'calendar' | 'timeline' | 'kanban'} [view] - Calling view context
 * @property {boolean} [ignoreStatusFilter] - When true, bypasses pending/completed/urgent filters
 */

export {};

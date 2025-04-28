console.log("Script start"); // Log script execution start

// --- DOM Elements ---
const taskForm = document.getElementById('add-task-form');
const newTaskInput = document.getElementById('new-task-input');
let columns = document.querySelectorAll('.kanban-column');
let tasksContainers = document.querySelectorAll('.tasks-container');
const trashArea = document.getElementById('trash-area');
// --- Project Tab Elements ---
const projectTabsContainer = document.getElementById('project-tabs');
const addProjectBtn = document.getElementById('add-project-btn');
// --- End Project Tab Elements ---

// --- State ---
// let tasks = []; // Array to hold task objects { id, title, column, order }
// --- New State Structure --- 
let appData = {
    projects: [], // { id, name, tasks: [{ id, title, column, order, color }] }
    activeProjectId: null
};
const APP_DATA_STORAGE_KEY = 'kanbanAppData';
// --- End New State Structure ---

let draggedTask = null; // Element being dragged
let draggedTaskId = null; // ID of the task being dragged
let nextColorIndex = 0; // Index for cycling through taskColors
let lastDroppedTaskId = null; // Track last dropped task for animation
let draggedTab = null; // Tab element being dragged
let draggedTabId = null; // Project ID of the tab being dragged
let isAddingProject = false; // Flag to prevent multiple add inputs

// --- Color Palette ---
// Expanded palette of background colors for tasks (suitable for dark theme)
const taskColors = [
    '#4a4e69', // Slate Gray
    '#003049', // Dark Midnight Blue
    '#585123', // Olive Green
    '#5f0f40', // Dark Magenta/Purple
    '#432818', // Dark Brown
    '#2d6a4f', // Dark Teal
    '#7b2cbf', // Vibrant Purple
    '#006d77', // Medium Teal
    '#8338ec', // Bright Violet
    '#3a5a40', // Dark Green
    '#219ebc', // Cerulean Blue
    '#fb8500', // Orange Peel
    '#6a4c93', // Royal Purple
    '#1d3557', // Prussian Blue
    '#007f5f', // Tropical Rain Forest Green
    '#5e60ce', // Majestic Purple
    '#44633f', // Forest Floor Green
    '#705d56', // Taupe Gray
    '#023e8a', // Royal Blue
    '#480ca8', // Galaxy Purple
    '#b5838d', // Rose Taupe
    '#ff6f00', // Tangerine
    '#31572c', // Castleton Green
    '#6d597a'  // Dusky Purple
];

// Function to get the next color in the cycle
function getNextTaskColor() {
    const color = taskColors[nextColorIndex];
    nextColorIndex = (nextColorIndex + 1) % taskColors.length; // Increment and wrap around
    // Persist nextColorIndex change if needed
    // saveAppData(); // Maybe save app data here if color index persistence is crucial across sessions
    return color;
}

// --- Persistence Functions ---
// const TASKS_STORAGE_KEY = 'kanbanTasks'; // Replaced

function generateId(prefix = 'id') {
    return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function loadAppData() {
    console.log("Loading app data...");
    const storedData = localStorage.getItem(APP_DATA_STORAGE_KEY);
    if (storedData) {
        try {
            appData = JSON.parse(storedData);
            console.log("App data loaded from localStorage:", appData);
            // Basic validation
            if (!appData.projects || !Array.isArray(appData.projects)) {
                console.warn("Invalid projects array found, resetting.");
                appData.projects = [];
            }
            if (!appData.activeProjectId && appData.projects.length > 0) {
                appData.activeProjectId = appData.projects[0].id; // Default to first project if active ID missing
            } else if (appData.projects.length === 0) {
                appData.activeProjectId = null;
            }
        } catch (e) {
            console.error("Error parsing app data from localStorage:", e);
            // Reset to default if parsing fails
            appData = { projects: [], activeProjectId: null };
        }
    }

    // Ensure at least one default project exists
    if (appData.projects.length === 0) {
        console.log("No projects found, creating default project.");
        const defaultProjectId = generateId('proj');
        const defaultProject = {
            id: defaultProjectId,
            name: 'Default Project',
            tasks: []
        };
        appData.projects.push(defaultProject);
        appData.activeProjectId = defaultProjectId;
        saveAppData(); // Save the newly created default project
    }

    // Ensure activeProjectId is valid
    if (!appData.activeProjectId || !appData.projects.some(p => p.id === appData.activeProjectId)) {
         console.warn("Active project ID is invalid or missing, setting to first project.");
         appData.activeProjectId = appData.projects.length > 0 ? appData.projects[0].id : null;
         if (appData.activeProjectId) { // Only save if we actually set a valid ID
            saveAppData();
         }
    }

    console.log(`App data loaded. Active project: ${appData.activeProjectId}`);
}

function saveAppData() {
    try {
        localStorage.setItem(APP_DATA_STORAGE_KEY, JSON.stringify(appData));
        console.log("App data saved to localStorage.");
    } catch (e) {
        console.error("Error saving app data to localStorage:", e);
        // Potentially notify the user that saving failed
    }
}

// --- Helper to get current project's data ---
function getActiveProject() {
    if (!appData.activeProjectId) return null;
    return appData.projects.find(p => p.id === appData.activeProjectId);
}

function getActiveTasks() {
    const activeProject = getActiveProject();
    return activeProject ? activeProject.tasks : [];
}
// --- End Helper Functions --- 

// --- Project Tab Functions ---
function renderTabs() {
    console.log("Rendering project tabs...");
    projectTabsContainer.innerHTML = ''; // Clear existing tabs
    isAddingProject = false; // Reset flag on render

    if (!appData || !appData.projects) {
        console.error("Cannot render tabs: appData or projects array is missing.");
        return;
    }

    // Render actual project tabs
    appData.projects.forEach(project => {
        const tab = document.createElement('button');
        tab.classList.add('project-tab');
        tab.textContent = project.name;
        tab.dataset.projectId = project.id;
        tab.setAttribute('draggable', 'true'); // Make project tabs draggable
        if (project.id === appData.activeProjectId) {
            tab.classList.add('active');
        }
        projectTabsContainer.appendChild(tab);
    });

    // Append the "Add Project" tab
    const addTab = document.createElement('button');
    addTab.classList.add('project-tab-add');
    addTab.id = 'add-project-tab'; // Specific ID for easy targeting
    addTab.textContent = '+';
    addTab.setAttribute('draggable', 'false'); // Ensure Add tab is not draggable
    projectTabsContainer.appendChild(addTab);

    console.log(`Rendered ${appData.projects.length} project tabs + Add tab. Active: ${appData.activeProjectId}`);
}

// Click event logic moved to delegated listener below
function handleTabClickLogic(projectId) {
    if (!projectId) {
        console.warn("Tab click logic ignored: No project ID.");
        return;
    }
    console.log(`Tab clicked: ${projectId}`);
    if (projectId !== appData.activeProjectId) {
        console.log(`Switching active project from ${appData.activeProjectId} to ${projectId}`);
        appData.activeProjectId = projectId;
        saveAppData();
        renderTabs(); // Re-render tabs to show new active state
        renderTasks(); // Re-render tasks for the new active project
    } else {
        console.log("Clicked active tab, no change needed.");
    }
}

// --- Tab Drag and Drop Handlers ---
function handleTabDragStart(event) {
    const target = event.target;
    if (target.classList.contains('project-tab')) {
        draggedTab = target;
        draggedTabId = target.dataset.projectId;
        event.dataTransfer.setData('text/plain', draggedTabId);
        event.dataTransfer.effectAllowed = 'move';
        // Delay adding class to allow drag image generation
        setTimeout(() => {
            draggedTab.classList.add('tab-dragging');
        }, 0);
        console.log("Tab Drag Start:", draggedTabId);
    }
}

function handleTabDragOver(event) {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';

    const targetTab = event.target.closest('.project-tab');
    if (!targetTab || targetTab === draggedTab) {
         // Clear indicators if not over a valid target tab or over itself
         clearTabDragIndicators();
         return;
    }

    const rect = targetTab.getBoundingClientRect();
    const isAfter = event.clientX > rect.left + rect.width / 2;

    // Clear previous indicators before setting new ones
    clearTabDragIndicators();

    if (isAfter) {
        targetTab.classList.add('tab-drag-over-after');
    } else {
        targetTab.classList.add('tab-drag-over-before');
    }
}

function handleTabDrop(event) {
    event.preventDefault();
    clearTabDragIndicators();
    if (!draggedTabId) return;

    const targetElement = event.target;
    const addTabElement = document.getElementById('add-project-tab');

    // Prevent dropping onto or after the Add tab
    if (targetElement === addTabElement || (targetElement.closest('.project-tab') && targetElement.closest('.project-tab') === addTabElement)) {
        console.log("Drop prevented: Cannot drop onto or after the Add tab.");
        return;
    }

    const targetTabElement = targetElement.closest('.project-tab');
    const targetProjectId = targetTabElement ? targetTabElement.dataset.projectId : null;

    if (targetProjectId === draggedTabId) {
        console.log("Dropped tab onto itself, no change.");
        return; // Dropped on itself
    }

    const originalIndex = appData.projects.findIndex(p => p.id === draggedTabId);
    if (originalIndex === -1) {
        console.error("Dragged project not found in appData!");
        return;
    }

    const [movedProject] = appData.projects.splice(originalIndex, 1);

    let targetIndex = -1;
    if (targetTabElement) {
        const rect = targetTabElement.getBoundingClientRect();
        const isAfter = event.clientX > rect.left + rect.width / 2;
        targetIndex = appData.projects.findIndex(p => p.id === targetProjectId);

        if (targetIndex !== -1) {
            appData.projects.splice(targetIndex + (isAfter ? 1 : 0), 0, movedProject);
        } else {
             console.warn("Target project for drop not found, appending before Add tab.");
             appData.projects.push(movedProject); // Add to end (which is before Add tab)
        }
    } else {
        // Dropped in the container but not on a specific tab (append to end - before Add tab)
        appData.projects.push(movedProject);
        console.log("Dropped tab in container, appending before Add tab.");
    }

    console.log("New project order:", appData.projects.map(p => p.name));
    saveAppData();
    renderTabs(); // Re-render with the new order
}

function handleTabDragEnd(event) {
    if (draggedTab) {
        draggedTab.classList.remove('tab-dragging');
    }
    clearTabDragIndicators();
    draggedTab = null;
    draggedTabId = null;
    console.log("Tab Drag End");
}

function clearTabDragIndicators() {
    document.querySelectorAll('.project-tab.tab-drag-over-before, .project-tab.tab-drag-over-after').forEach(tab => {
        tab.classList.remove('tab-drag-over-before', 'tab-drag-over-after');
    });
}

// --- End Tab Drag and Drop Handlers ---

// --- Task Management ---
function createTaskElement(task) {
    const taskElement = document.createElement('div');
    taskElement.classList.add('task');
    
    // --- Apply Task Color ---
    taskElement.style.backgroundColor = task.color || taskColors[0];
    // --- End Apply Task Color ---

    taskElement.setAttribute('draggable', 'true');
    taskElement.dataset.taskId = task.id;
    taskElement.textContent = task.title;

    // Add drag event listeners to the task element
    taskElement.addEventListener('dragstart', handleDragStart);
    taskElement.addEventListener('dragend', handleDragEnd);
    taskElement.addEventListener('dragover', handleDragOverTask); // For reordering

    return taskElement;
}

function renderTasks() {
    console.log("Starting renderTasks (Clear & Rebuild strategy)...");
    const activeProject = getActiveProject();
    const tasksToRender = activeProject ? activeProject.tasks : [];

    if (!activeProject) {
        console.warn("RenderTasks called but no active project found. Clearing columns.");
    }
    console.log(`[Render] Rendering tasks for project: ${activeProject?.id}. Total tasks: ${tasksToRender.length}`);

    columns.forEach(column => {
        const columnId = column.id;
        const container = column.querySelector('.tasks-container');
        if (!container) {
            console.error(`Tasks container not found for column ${columnId}`);
            return;
        }

        // --- Clear and Rebuild --- 
        container.innerHTML = ''; // Clear existing tasks in the column

        // Get tasks for this column, sorted by order
        const tasksForColumn = tasksToRender
            .filter(task => task.column === columnId)
            .sort((a, b) => a.order - b.order);

        // Create and append task elements
        tasksForColumn.forEach(taskData => {
            // --- LOGGING: Task Data during Render --- 
            console.log(`[Render] Processing task ${taskData.id} for column ${columnId}. Data:`, JSON.parse(JSON.stringify(taskData)));
            
            const taskElement = createTaskElement(taskData); // Create the basic element
            
            // --- Apply completed state explicitly after creation ---
            if (taskData.column === 'col-completed') {
                // --- LOGGING: Applying Completed Class --- 
                console.log(`[Render] --> ADDING .completed class to ${taskData.id}`);
                taskElement.classList.add('completed');
            } else {
                // --- LOGGING: NOT Applying Completed Class --- 
                // Optional: Log if it *would* remove it, though createTaskElement doesn't add it.
                // console.log(`[Render] --> Ensuring .completed class is NOT on ${taskData.id}`);
            }
            // --- End completed state --- 

            container.appendChild(taskElement); // Add to the DOM
        });
        // --- LOGGING: Column Done --- 
        if(columnId === 'col-completed') {
            console.log(`[Render] Finished rendering 'col-completed'. Container innerHTML length: ${container.innerHTML.length}`);
        }
        // --- End Clear and Rebuild ---
    });

    console.log("[Render] RenderTasks (Clear & Rebuild) finished.");
}

function addTask(title) {
    const activeProject = getActiveProject();
    if (!activeProject) {
        console.error("Cannot add task: No active project selected.");
        // Optionally: alert the user or provide feedback
        return;
    }

    const newTask = {
        id: generateId('task'), // Use new ID generator
        title: title.trim(),
        column: 'col-todo', // Default to the first column
        order: getNextOrderForColumn('col-todo'), // Assign order within the active project
        color: getNextTaskColor() // Assign the next color cyclically
    };
    activeProject.tasks.push(newTask);
    saveAppData();
    renderTasks(); // Re-render tasks for the active project
}

// Recalculate Task Order within a column for the ACTIVE project
function recalculateOrder(columnId) {
    const activeProject = getActiveProject();
    if (!activeProject) return;

    console.log(`Recalculating order for column: ${columnId} in project ${activeProject.id}`);
    let orderCounter = 0;
    // Iterate through the active project's tasks
    activeProject.tasks.forEach(task => {
        if (task.column === columnId) {
            task.order = orderCounter++;
        }
    });
    console.log(`Finished recalculating order for ${columnId}. ${orderCounter} tasks found.`);
    // Save is usually called after the action that triggers recalculation (e.g., drop, delete)
    // saveAppData(); // Avoid redundant saves if called after another save
}

// Helper to determine the next order value for a new task in a column for the ACTIVE project
function getNextOrderForColumn(columnId) {
    const activeTasks = getActiveTasks(); // Get tasks for the current project
    const tasksInColumn = activeTasks.filter(task => task.column === columnId);
    return tasksInColumn.length > 0 ? Math.max(...tasksInColumn.map(t => t.order)) + 1 : 0;
}


// --- Event Handlers ---

// Add Task Form Submission
function handleAddTaskSubmit(event) {
    event.preventDefault();
    const title = newTaskInput.value;
    if (title) {
        addTask(title);
        newTaskInput.value = ''; // Clear input
        newTaskInput.focus();
    }
}

// --- Drag and Drop Handlers (Revised Reordering Logic) ---

function handleDragStart(event) {
    // Check if the event target is actually a task
    if (event.target.classList.contains('task')) {
        draggedTask = event.target;
        draggedTask.dataset.draggingSource = 'true'; // Mark the source
        draggedTaskId = event.target.dataset.taskId;
        event.dataTransfer.setData('text/plain', draggedTaskId);
        event.dataTransfer.effectAllowed = 'move';

        // --- Custom Drag Image --- 
        const taskClone = draggedTask.cloneNode(true); // Clone the node
        taskClone.style.position = 'absolute';
        taskClone.style.top = '-9999px'; // Position off-screen
        taskClone.style.opacity = '0.95'; // Make the GHOST less transparent
        taskClone.style.pointerEvents = 'none'; // Prevent interference
        const computedStyle = window.getComputedStyle(draggedTask);
        taskClone.style.backgroundColor = computedStyle.backgroundColor;
        document.body.appendChild(taskClone);
        event.dataTransfer.setDragImage(taskClone, 0, 0);
        setTimeout(() => {
            document.body.removeChild(taskClone);
        }, 0);
        // --- End Custom Drag Image ---

        // Apply styling to the ORIGINAL element (delayed slightly)
        setTimeout(() => {
            draggedTask.classList.add('dragging'); // Keep for state/pointer-events
            draggedTask.classList.add('task-drag-preview'); // Add preview style
        }, 0);
        console.log(`Drag Start: ${draggedTaskId}`);
    } else {
        event.preventDefault(); // Prevent dragging if not a task
    }
}

function handleDragEnd(event) {
    if (draggedTask) {
        draggedTask.classList.remove('dragging');
        draggedTask.classList.remove('task-drag-preview'); // Remove preview style
        delete draggedTask.dataset.draggingSource; // Remove the source marker
        console.log(`Drag End: ${draggedTaskId}`);
    }
    // Clear temporary drag-over styles
    columns.forEach(col => col.classList.remove('drag-over'));
    trashArea.classList.remove('drag-over');
    
    draggedTask = null;
    draggedTaskId = null;
}

// Drag over columns
function handleDragOverColumn(event) {
    event.preventDefault(); // ** Ensure preventDefault is always called **
    event.dataTransfer.dropEffect = 'move';
    this.classList.add('drag-over'); // 'this' refers to the column div

    // Update dragged task position based on column hover
    updateDraggedTaskPosition(event, this);
}

// Drag leaving columns
function handleDragLeaveColumn(event) {
    const related = event.relatedTarget;
    const columnRect = this.getBoundingClientRect();
    if (
        event.clientX >= columnRect.left &&
        event.clientX <= columnRect.right &&
        event.clientY >= columnRect.top &&
        event.clientY <= columnRect.bottom
    ) {
        return; 
    }
    if (!related || !this.contains(related)) {
        console.log("Leaving column bounds, removing drag-over state");
        this.classList.remove('drag-over');
    }
}

// Drag over individual tasks (for reordering)
function handleDragOverTask(event) {
    event.preventDefault(); // ** Ensure preventDefault is ALWAYS FIRST **
    event.stopPropagation(); // Prevent triggering column's dragover

    const targetTaskElement = event.target.closest('.task');
    const columnElement = event.target.closest('.kanban-column');

    if (!columnElement) return; // Should always have a column

    // Ensure the parent column also shows drag-over state
    columnElement.classList.add('drag-over');

    // Update dragged task position based on task hover
    updateDraggedTaskPosition(event, columnElement);
}

// Renamed function: Moves the actual dragged task element AND animates siblings
function updateDraggedTaskPosition(event, columnElement) {
    if (!draggedTask) return;

    const container = columnElement.querySelector('.tasks-container');
    if (!container) return;

    // --- Calculate Target Position based on Mouse --- 
    const dropY = event.clientY;
    const tasksInColumn = container.querySelectorAll('.task:not(.dragging)'); 
    let elementToInsertBefore = null;
    for (const taskElement of tasksInColumn) {
        const rect = taskElement.getBoundingClientRect();
        const threshold = rect.top + rect.height * 0.55; 
        if (dropY < threshold) {
            elementToInsertBefore = taskElement;
            break;
        }
    }
    // --- End Calculation ---

    // --- Check if Move is Needed --- 
    const needsMove = !(draggedTask.parentNode === container && draggedTask.nextElementSibling === elementToInsertBefore);

    if (needsMove) {
        // --- 1. Record PRE-MOVE positions of SIBLINGS --- 
        const preMovePositions = new Map();
        const siblingTasks = container.querySelectorAll('.task:not(.dragging)');
        siblingTasks.forEach(taskEl => {
            preMovePositions.set(taskEl.dataset.taskId, taskEl.getBoundingClientRect());
        });

        // --- 2. MOVE the draggedTask Element --- 
        try {
            if (elementToInsertBefore) {
                 container.insertBefore(draggedTask, elementToInsertBefore);
            } else {
                container.appendChild(draggedTask);
            }
        } catch (domError) {
            console.error("Error moving dragged task:", domError);
            return; // Exit if move failed
        }

        // --- 3. Animate SIBLINGS based on position change --- 
        siblingTasks.forEach(taskEl => {
            const taskId = taskEl.dataset.taskId;
            const preMoveRect = preMovePositions.get(taskId);
            if (!preMoveRect) return; // Should exist, but safety check

            const postMoveRect = taskEl.getBoundingClientRect();
            const deltaY = preMoveRect.top - postMoveRect.top;
            const deltaX = preMoveRect.left - postMoveRect.left; // Also capture X delta just in case

            // Only animate if position actually changed significantly
            if (Math.abs(deltaY) > 1 || Math.abs(deltaX) > 1) { 
                 // console.log(`Animating sibling ${taskId}: dX=${deltaX.toFixed(1)}, dY=${deltaY.toFixed(1)}`);
                 taskEl.animate([
                     { transform: `translate(${deltaX}px, ${deltaY}px)` }, // Start from PREVIOUS pos
                     { transform: 'translate(0, 0)' }                   // Animate to CURRENT pos
                 ], {
                     duration: 150, // Slightly faster animation during drag
                     easing: 'ease-out',
                     fill: 'backwards' // Apply starting state immediately
                 });
            }
        });
    }
    // --- End Moving & Animating --- 
}

// Drop on columns
function handleDropOnColumn(event) {
    event.preventDefault();
    event.stopPropagation();
    const targetColumnElement = this; 
    targetColumnElement.classList.remove('drag-over');

    const targetColumnId = targetColumnElement.id;
    if (!draggedTaskId || !draggedTask) return;

    const activeProject = getActiveProject();
    if (!activeProject) {
         console.error("Drop failed: No active project.");
         return; // Cannot proceed without an active project
    }
    const currentTasks = activeProject.tasks; // Work with active project's tasks

    lastDroppedTaskId = draggedTaskId;

    console.log(`--- Drop Event Start (Reverted Animation) ---`);
    console.log(`Drop on Column: ${targetColumnId}, Task: ${draggedTaskId}`);

    // --- Step 1: Determine Target Element ID based on drop coordinates --- 
    const dropY = event.clientY;
    let elementToInsertBefore = null; // This will be a DOM element
    
    // Get the actual DOM elements currently in the target column's container
    const targetContainer = targetColumnElement.querySelector('.tasks-container');
    if (!targetContainer) {
        console.error("Drop failed: Target container not found in column", targetColumnId);
        return;
    }
    const tasksInColumnElements = targetContainer.querySelectorAll('.task:not(.dragging)'); // Exclude the one being dragged if it's already there

    // Iterate over DOM elements to find the insertion point
    for (const currentTaskElement of tasksInColumnElements) {
        const rect = currentTaskElement.getBoundingClientRect(); // Correct: Call on DOM element
        const threshold = rect.top + rect.height * 0.55;
        if (dropY < threshold) {
            elementToInsertBefore = currentTaskElement; // Store the DOM element
            break;
        }
    }
    const targetElementId = elementToInsertBefore ? elementToInsertBefore.dataset.taskId : null; // Get ID from the target DOM element
    console.log(`Drop Calc: Target element ID (from drop Y ${dropY.toFixed(1)}): ${targetElementId}`);

    // --- Step 2: Remove the dragged task data from the array --- 
    const draggedTaskIndex = currentTasks.findIndex(t => t.id === draggedTaskId);
    if (draggedTaskIndex === -1) {
        console.error("Could not find dragged task in active project's tasks array for removal");
        renderTasks(); // Still call render to try and recover state
        return;
    }
    const [draggedTaskData] = currentTasks.splice(draggedTaskIndex, 1);
    const oldColumnId = draggedTaskData.column;

    // --- LOGGING: Before Update --- 
    console.log(`[Drop] Task ${draggedTaskId} Data BEFORE update: column=${oldColumnId}`);
    
    draggedTaskData.column = targetColumnId; // Update column in data
    
    // --- LOGGING: After Update ---
    console.log(`[Drop] Task ${draggedTaskId} Data AFTER update: column=${draggedTaskData.column}`);

    // --- Step 3: Find the new index in the tasks array based on targetElementId --- 
    let finalInsertionIndex = -1;
    if (targetElementId) {
        finalInsertionIndex = currentTasks.findIndex(t => t.id === targetElementId);
        if (finalInsertionIndex === -1) {
             console.warn(`Drop Calc: Target element ${targetElementId} not found in data array AFTER removal! Calculating end index.`);
        }
    }

    if (!targetElementId || finalInsertionIndex === -1) {
        console.log(`Drop Calc: Dropped at end or target not found. Calculating end-of-column index.`);
        let lastTaskInColumnIndex = -1;
        for (let i = currentTasks.length - 1; i >= 0; i--) {
            if (currentTasks[i].column === targetColumnId) {
                lastTaskInColumnIndex = i;
                break;
            }
        }
        finalInsertionIndex = (lastTaskInColumnIndex !== -1) ? lastTaskInColumnIndex + 1 : currentTasks.length;
        console.log(`Drop Calc: Calculated target end-of-column index: ${finalInsertionIndex}`);
    }

     if (finalInsertionIndex < 0) {
        console.warn("Drop Calc: Final calculated index invalid. Appending to end.");
        finalInsertionIndex = currentTasks.length;
    }
    console.log(`Final data insertion index: ${finalInsertionIndex}`);

    // --- Step 4: Insert the dragged task data at the final index --- 
    currentTasks.splice(finalInsertionIndex, 0, draggedTaskData);
    console.log(`Task ${draggedTaskData.id} data inserted. Project tasks array length: ${currentTasks.length}`);

    // --- Step 5: Recalculate order for affected columns --- 
    console.log(`Recalculating order for target column: ${targetColumnId}`);
    recalculateOrderForColumn(targetColumnId); // Uses active project context
    if (oldColumnId !== targetColumnId) {
        recalculateOrderForColumn(oldColumnId);
    }

    // --- LOGGING: Before Save --- 
    console.log(`[Drop] appData state just BEFORE save:`, JSON.parse(JSON.stringify(appData))); // Deep copy for logging

    saveAppData(); // Save the updated app data

    // --- Step 6: Render --- 
    console.log("[Drop] Calling final renderTasks after drop...");
    renderTasks(); // Rely on this to set the correct classes based on updated data
    
    console.log(`--- Drop Event End ---`);
}

// Recalculate order for the affected column(s)
function recalculateOrderForColumn(columnId) {
    const activeProject = getActiveProject();
    if (!activeProject) return;

    console.log(`Recalculating order for column: ${columnId} in project ${activeProject.id}`);
    let orderCounter = 0;
    // Iterate through the active project's tasks IN ITS CURRENT ORDER
    activeProject.tasks.forEach(task => {
        if (task.column === columnId) {
            // Assign sequential order based on current array position within this column
            task.order = orderCounter++;
        }
    });
    console.log(`Finished recalculating order for ${columnId}. ${orderCounter} tasks found.`);
    // Save is called by the caller (handleDropOnColumn)
    // saveAppData(); // Removed redundant save
}

// --- Trash Area Handlers (Updated) ---

// Drag over Trash Area
function handleDragOverTrash(event) {
    event.preventDefault();
    // Accept both tasks and tabs
    if (draggedTaskId || draggedTabId) {
        event.dataTransfer.dropEffect = 'move';
        this.classList.add('drag-over');
    } else {
        event.dataTransfer.dropEffect = 'none'; // Don't allow drop if nothing relevant is dragged
    }
}

// Drag leaving Trash Area
function handleDragLeaveTrash(event) {
     // Check if the mouse truly left the element and its children
     if (!this.contains(event.relatedTarget)) {
         this.classList.remove('drag-over');
     }
}

// Drop on Trash Area
function handleDropOnTrash(event) {
    event.preventDefault();
    this.classList.remove('drag-over');

    // --- Handle Task Deletion --- 
    if (draggedTaskId) {
        console.log(`Drop Task on Trash: ${draggedTaskId}`);
        const activeProject = getActiveProject();
        if (!activeProject) {
            console.error("Task delete failed: No active project.");
            return;
        }
        const currentTasks = activeProject.tasks;
        const taskIndex = currentTasks.findIndex(t => t.id === draggedTaskId);

        if (taskIndex > -1) {
            const deletedTaskColumn = currentTasks[taskIndex].column;
            currentTasks.splice(taskIndex, 1); // Remove task
            recalculateOrderForColumn(deletedTaskColumn); // Re-order source column
            saveAppData();
            renderTasks(); // Re-render tasks for the active project
            console.log(`Task ${draggedTaskId} deleted.`);
        } else {
            console.error("Could not find task to delete in active project with ID:", draggedTaskId);
        }
    // --- Handle Project Deletion --- 
    } else if (draggedTabId) {
        console.log(`Drop Project Tab on Trash: ${draggedTabId}`);
        const projectIndex = appData.projects.findIndex(p => p.id === draggedTabId);

        if (projectIndex > -1) {
            const projectToDelete = appData.projects[projectIndex];
            
            // --- Determine if confirmation is needed --- 
            let needsConfirmation = true; 
            const tasks = projectToDelete.tasks;
            if (tasks.length === 0) {
                needsConfirmation = false;
                console.log("Skipping delete confirmation: Project is empty.");
            } else if (tasks.every(task => task.column === 'col-completed')) {
                needsConfirmation = false;
                console.log("Skipping delete confirmation: All tasks are completed.");
            }
            // --- End Confirmation Check ---

            // Proceed with deletion if no confirmation needed OR user confirms
            if (!needsConfirmation || confirm(`Are you sure you want to delete the project "${projectToDelete.name}"? This cannot be undone.`)) {
                const deletedProjectId = projectToDelete.id;
                appData.projects.splice(projectIndex, 1); // Remove project
                console.log(`Project ${deletedProjectId} deleted from data.`);

                // Handle active project change if necessary
                if (appData.activeProjectId === deletedProjectId) {
                    console.log("Active project was deleted. Selecting new active project.");
                    if (appData.projects.length > 0) {
                        const newActiveIndex = Math.max(0, projectIndex - 1);
                        appData.activeProjectId = appData.projects[newActiveIndex].id;
                        console.log(`New active project set to: ${appData.activeProjectId}`);
                    } else {
                        appData.activeProjectId = null;
                        console.log("No projects remaining. Active project set to null.");
                    }
                }

                saveAppData();
                renderTabs();   // Re-render tabs
                renderTasks();  // Re-render tasks
            } else {
                console.log("Project deletion cancelled by user (or skipped due to confirmation).");
            }
        } else {
            console.error("Could not find project to delete with ID:", draggedTabId);
        }
    } else {
         console.log("Drop on trash ignored: No valid task or tab ID found.");
    }

    // Ensure dragged IDs are cleared
    draggedTaskId = null;
    draggedTabId = null;
}

// --- End Trash Area Handlers ---

// --- Add Project Inline Input Functions ---
function showAddProjectInput(addTabElement) {
    if (isAddingProject) return; // Prevent multiple inputs
    isAddingProject = true;

    addTabElement.textContent = ''; // Clear the '+'
    addTabElement.style.padding = '0'; // Remove padding to fit input better
    addTabElement.style.borderStyle = 'solid'; // Change border while input is active

    const input = document.createElement('input');
    input.type = 'text';
    input.classList.add('tab-input');
    input.placeholder = "New Project Name...";
    input.id = 'new-project-input'; // ID for potential future reference

    input.addEventListener('blur', handleNewProjectInput);
    input.addEventListener('keydown', handleNewProjectInput);

    addTabElement.appendChild(input);
    input.focus();
}

function handleNewProjectInput(event) {
    const inputElement = event.target;
    const addTabElement = inputElement.closest('.project-tab-add');
    const projectName = inputElement.value.trim();

    // Check the flag first
    if (!isAddingProject) {
        console.log("handleNewProjectInput skipped: isAddingProject is false.");
        // Ensure listeners are removed if flag is false but somehow event fires
        removeInputListeners(inputElement);
        return;
    }

    if (event.type === 'keydown' && event.key === 'Enter') {
        event.preventDefault();
        if (projectName) {
            console.log("Enter pressed - creating project:", projectName);
            // --- Explicitly remove blur listener --- 
            inputElement.removeEventListener('blur', handleNewProjectInput);
            console.log("Blur listener removed explicitly.");
            // --- Proceed with creation ---
            createNewProject(projectName);
            cancelNewProjectInput(addTabElement, true); // Clean up visuals/flag
            renderTabs(); // Re-render UI
            renderTasks();
        } else {
            // Enter pressed, empty name: Cancel
            console.log("Enter pressed - empty name, cancelling.");
            cancelNewProjectInput(addTabElement);
        }
    } else if (event.type === 'blur') {
        // Blur event - This should only run if Enter didn't handle it
        console.log("Blur event triggered.");
        if (projectName) {
            console.log("Blur - creating project:", projectName);
            // Ensure keydown listener is also removed
            removeInputListeners(inputElement);
            createNewProject(projectName);
            cancelNewProjectInput(addTabElement, true); // Clean up visuals/flag
            renderTabs(); // Re-render UI
            renderTasks();
        } else {
            // Blur, empty name: Cancel
            console.log("Blur - empty name, cancelling.");
            cancelNewProjectInput(addTabElement);
        }
    } else if (event.type === 'keydown' && event.key === 'Escape') {
        console.log("Escape pressed - cancelling.");
        cancelNewProjectInput(addTabElement);
    }
}

// Helper function to create the project
function createNewProject(projectName) {
    if (!appData.projects) appData.projects = [];
    const newProjectId = generateId('proj');
    const newProject = {
        id: newProjectId,
        name: projectName,
        tasks: []
    };
    appData.projects.push(newProject);
    appData.activeProjectId = newProjectId;
    saveAppData();
    console.log("New project created and saved:", newProject);
}

// Updated cancel function
function cancelNewProjectInput(addTabElement, projectCreated = false) {
    if (!addTabElement) return;

    const input = addTabElement.querySelector('.tab-input');
    if (input) {
        removeInputListeners(input); // Remove listeners first
        addTabElement.removeChild(input); // Then remove element
        console.log("Input element removed and listeners detached.");
    }

    // Restore '+' only if cancelled, not if created (renderTabs handles created)
    if (!projectCreated) {
        addTabElement.innerHTML = '+';
        addTabElement.style.padding = '';
        addTabElement.style.borderStyle = '';
        console.log("'+' tab restored.");
    }

    isAddingProject = false; // Reset the flag
    console.log("cancelNewProjectInput finished. projectCreated:", projectCreated, "isAddingProject:", isAddingProject);
}

// Helper to remove listeners
function removeInputListeners(inputElement) {
     if (!inputElement) return;
     inputElement.removeEventListener('blur', handleNewProjectInput);
     inputElement.removeEventListener('keydown', handleNewProjectInput);
     console.log("Input listeners removed.");
}
// --- End Add Project Inline Input Functions ---

// --- Initialization ---
function initializeApp() {
    console.log("initializeApp start"); // Log init start
    // Load app data (projects and active project ID)
    loadAppData();

    // --- Initialize Color Index based on the LAST task added across ALL projects? ---
    // This logic might need refinement. For now, let's base it on the last task of the *active* project
    // or just reset it simply.
    nextColorIndex = 0; // Simple reset for now
    /* // More complex (potentially inconsistent) logic:
    let latestTaskOverall = null;
    appData.projects.forEach(project => {
        if (project.tasks.length > 0) {
            const latestInProject = project.tasks.reduce((latest, current) => {
                 const latestTime = parseInt(latest.id.split('-')[1] || 0);
                 const currentTime = parseInt(current.id.split('-')[1] || 0);
                 return currentTime > latestTime ? current : latest;
            });
            if (!latestTaskOverall || parseInt(latestInProject.id.split('-')[1] || 0) > parseInt(latestTaskOverall.id.split('-')[1] || 0)) {
                 latestTaskOverall = latestInProject;
            }
        }
    });
    if (latestTaskOverall && latestTaskOverall.color) {
        const lastColorIndex = taskColors.indexOf(latestTaskOverall.color);
        if (lastColorIndex !== -1) {
             nextColorIndex = (lastColorIndex + 1) % taskColors.length;
             console.log(`Initialized nextColorIndex based on latest task overall color to: ${nextColorIndex}`);
        }
    }
    */
    // --- End Initialize Color Index ---

    // Initial render (will render the active project's tasks)
    console.log("Calling initial renderTasks...");
    try {
        renderTasks();
        console.log("Initial renderTasks completed.");
    } catch (e) {
        console.error("Error during initial renderTasks:", e);
    }

    // Add event listeners
    taskForm.addEventListener('submit', handleAddTaskSubmit);

    // Re-select columns after potential DOM changes
    columns = document.querySelectorAll('.kanban-column');
    tasksContainers = document.querySelectorAll('.tasks-container');

    // Add drag/drop listeners to columns
    columns.forEach(column => {
        column.addEventListener('dragover', handleDragOverColumn);
        column.addEventListener('dragleave', handleDragLeaveColumn);
        column.addEventListener('drop', handleDropOnColumn); // Drop listener on the column itself

        // Container dragover listener is mainly for empty column drop zones
        const tasksContainer = column.querySelector('.tasks-container');
        if (tasksContainer) {
            tasksContainer.addEventListener('dragover', handleDragOverColumn.bind(column)); 
        }
    });

    // Drag listeners for tasks are added in createTaskElement

    // Add drag/drop listeners to trash area
    trashArea.addEventListener('dragover', handleDragOverTrash);
    trashArea.addEventListener('dragleave', handleDragLeaveTrash);
    trashArea.addEventListener('drop', handleDropOnTrash);

    console.log("App Initialized - Event listeners added.");
}

// Start the app using DOMContentLoaded
console.log("Adding DOMContentLoaded listener...");
document.addEventListener('DOMContentLoaded', () => {
    console.log("DOM fully loaded and parsed");

    // --- Get Element References ---
    const projectTabsContainer = document.getElementById('project-tabs');
    const columns = document.querySelectorAll('.kanban-column');
    const addTaskForm = document.getElementById('add-task-form');
    const newTaskInput = document.getElementById('new-task-input');
    const trashArea = document.getElementById('trash-area');
    const addProjectBtn = document.getElementById('add-project-btn'); // Get Add Project button

    // --- Load Data ---
    initializeApp(); // This loads data and sets up initial state

    // --- Render Initial UI ---
    if (appData) {
        renderTabs(); // Render initial tabs
        renderTasks(); // Render initial tasks for the active project
    } else {
        console.error("Initialization failed: appData is not available.");
        // Handle error, maybe show a message to the user
        return; // Stop further execution if appData is missing
    }

    // --- Add Event Listeners ---

    // Project Tab Clicks & Drag/Drop (using event delegation on container)
    if (projectTabsContainer) {
        // Click Handler
        projectTabsContainer.addEventListener('click', (event) => {
             const tab = event.target.closest('.project-tab, .project-tab-add');
             if (!tab) return; // Click wasn't on a tab or the add button

             if (tab.id === 'add-project-tab') {
                 console.log("Add project tab clicked");
                 showAddProjectInput(tab); // Initiate inline input
             } else if (tab.classList.contains('project-tab')) {
                 handleTabClickLogic(tab.dataset.projectId); // Handle regular tab click
             }
        });

        // Drag Handlers
        projectTabsContainer.addEventListener('dragstart', handleTabDragStart);
        projectTabsContainer.addEventListener('dragover', handleTabDragOver);
        projectTabsContainer.addEventListener('drop', handleTabDrop);
        projectTabsContainer.addEventListener('dragend', handleTabDragEnd);
        // Add dragleave to clear indicators when leaving the container
        projectTabsContainer.addEventListener('dragleave', (event) => {
            if (!projectTabsContainer.contains(event.relatedTarget)) {
                 clearTabDragIndicators();
            }
        });

    } else {
        console.error("Error: Project tabs container not found");
    }

    // Add Task Form Submission
    if (addTaskForm) {
        // ... existing code ...
    } else {
        console.error("Error: Add task form not found");
    }

    // Column/Task Drag and Drop Listeners (attached in initializeApp)

    console.log("DOM Listeners Added (including updated tab delegation)");
});

console.log("script.js execution end");
// Ensure all functions are defined before they are called, especially within event listeners.
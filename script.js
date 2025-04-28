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

    if (!appData || !appData.projects) {
        console.error("Cannot render tabs: appData or projects array is missing.");
        return;
    }

    appData.projects.forEach(project => {
        const tab = document.createElement('button');
        tab.classList.add('project-tab');
        tab.textContent = project.name;
        tab.dataset.projectId = project.id;
        tab.setAttribute('draggable', 'true'); // Make tab draggable
        if (project.id === appData.activeProjectId) {
            tab.classList.add('active');
        }
        // Tab click listener is handled by delegation now
        // tab.addEventListener('click', handleTabClick); // REMOVED
        projectTabsContainer.appendChild(tab);
    });
    console.log(`Rendered ${appData.projects.length} tabs. Active: ${appData.activeProjectId}`);
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

    const targetTabElement = event.target.closest('.project-tab');
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
            // Adjust index based on drop position relative to target center
            appData.projects.splice(targetIndex + (isAfter ? 1 : 0), 0, movedProject);
        } else {
             // Fallback: Append if target index is invalid (shouldn't happen ideally)
             console.warn("Target project for drop not found, appending.");
             appData.projects.push(movedProject);
        }
    } else {
        // Dropped in the container but not on a specific tab (append to end)
        appData.projects.push(movedProject);
        console.log("Dropped tab in container, appending to end.");
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
    if (task.column === 'col-completed') {
        taskElement.classList.add('completed');
    }

    // --- Apply Task Color ---
    // Apply the color stored with the task.
    // Add a fallback default color if somehow a task lacks one.
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
    console.log("Starting smart render...");
    const activeProject = getActiveProject();
    if (!activeProject) {
        console.warn("RenderTasks called but no active project found. Clearing columns.");
        columns.forEach(column => {
            const container = column.querySelector('.tasks-container');
            if (container) container.innerHTML = ''; // Clear content
        });
        return; // Nothing to render
    }

    const tasksToRender = activeProject.tasks; // Use tasks from the active project
    console.log(`Rendering tasks for project: ${activeProject.id} (${activeProject.name}), ${tasksToRender.length} tasks.`);

    const allRenderedTaskIds = new Set(); // Keep track of tasks rendered in this cycle

    columns.forEach(column => {
        const columnId = column.id;
        const container = column.querySelector('.tasks-container');
        if (!container) return;

        console.log(`Smart rendering column: ${columnId}`);

        // 1. Get desired state (sorted tasks for this column)
        const tasksForColumn = tasksToRender // Use project's tasks
            .filter(task => task.column === columnId)
            .sort((a, b) => a.order - b.order);

        // 2. Get current DOM elements for this column
        const currentTaskElements = Array.from(container.querySelectorAll('.task'));
        const currentElementMap = new Map(currentTaskElements.map(el => [el.dataset.taskId, el]));
        console.log(` -> Found ${currentTaskElements.length} existing DOM elements.`);

        // 3. Reconcile: Iterate through desired state and update/move/add DOM elements
        let previousElement = null; // Keep track of the last correctly positioned element
        tasksForColumn.forEach((taskData, index) => {
            allRenderedTaskIds.add(taskData.id); // Mark this task as processed
            let taskElement = currentElementMap.get(taskData.id);

            if (taskElement) {
                // --- Task exists: Update and Position --- 
                console.log(` -> Reconciling existing task: ${taskData.id}`);
                // Update content/classes if necessary (e.g., completed status, text)
                taskElement.textContent = taskData.title; // Ensure title is up-to-date
                 // Ensure correct 'completed' class state
                 if (taskData.column === 'col-completed' && !taskElement.classList.contains('completed')) {
                     taskElement.classList.add('completed');
                 } else if (taskData.column !== 'col-completed' && taskElement.classList.contains('completed')) {
                     taskElement.classList.remove('completed');
                 }
                 // Update color if needed (less common, but for completeness)
                 if (taskElement.style.backgroundColor !== taskData.color) {
                      taskElement.style.backgroundColor = taskData.color || taskColors[0];
                 }

                // Check position: Should it be after `previousElement`?
                 // The `insertBefore` method handles moves correctly. If the element
                 // is already in the correct position relative to the target sibling,
                 // it effectively does nothing.
                const expectedNextSibling = previousElement ? previousElement.nextElementSibling : container.firstChild;
                if (taskElement !== expectedNextSibling) {
                     console.log(` -> Moving task ${taskData.id} to position ${index}`);
                     container.insertBefore(taskElement, expectedNextSibling);
                }
                previousElement = taskElement; // Update the reference to the last correctly positioned element
                currentElementMap.delete(taskData.id); // Remove from map as it's been handled
            } else {
                // --- Task doesn't exist: Create and Insert --- 
                console.log(` -> Creating and inserting new task: ${taskData.id} at position ${index}`);
                taskElement = createTaskElement(taskData);
                // Insert at the correct position relative to the last placed element
                const insertBeforeElement = previousElement ? previousElement.nextElementSibling : container.firstChild;
                container.insertBefore(taskElement, insertBeforeElement);
                previousElement = taskElement; // Update the reference
            }
        });

        // 4. Remove leftover elements: Any elements remaining in currentElementMap 
        //    are no longer in the desired state for this column.
        currentElementMap.forEach((elementToRemove, taskId) => {
            console.log(` -> Removing task ${taskId} from column ${columnId}`);
            container.removeChild(elementToRemove);
        });
    });

    // Optional: A final check for tasks in the `tasks` array that somehow weren't rendered 
    // (e.g., assigned to a non-existent column). This is more defensive coding.
    tasksToRender.forEach(taskData => { // Check the rendered tasks
        if (!allRenderedTaskIds.has(taskData.id)) {
             console.warn(`Task ${taskData.id} exists in data but was not rendered. Assigning to default column.`);
             taskData.column = 'col-todo'; // Or handle appropriately
             // Potentially call renderTasks again or handle the error
        }
    });

    console.log("Smart render finished.");
    // saveAppData(); // Save is already called after drop/add/delete
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
    let elementToInsertBefore = null;
    const tasksForThreshold = currentTasks.filter(t => t.column === targetColumnId);
    for (const taskElement of tasksForThreshold) {
        const rect = taskElement.getBoundingClientRect();
        const threshold = rect.top + rect.height * 0.55;
        if (dropY < threshold) {
            elementToInsertBefore = taskElement;
            break;
        }
    }
    const targetElementId = elementToInsertBefore ? elementToInsertBefore.id : null;
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
    draggedTaskData.column = targetColumnId;
    console.log(`Task ${draggedTaskId} data removed from original index ${draggedTaskIndex} in project ${activeProject.id}`);

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

    saveAppData(); // Save the updated app data

    // --- Step 6: Render (NO ANIMATION HERE) --- 
    console.log("Calling final renderTasks after drop...");
    renderTasks();
    // --- Remove Animation Logic --- 
    // requestAnimationFrame(() => { ... removed ... });
    // --- End Remove Animation Logic --- 

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

// Drag over Trash Area
function handleDragOverTrash(event) {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move'; // Indicate it's a move (delete)
    this.classList.add('drag-over');
}

// Drag leaving Trash Area
function handleDragLeaveTrash(event) {
     this.classList.remove('drag-over');
}

// Drop on Trash Area
function handleDropOnTrash(event) {
    event.preventDefault();
    this.classList.remove('drag-over');

    console.log(`Drop on Trash: Task ${draggedTaskId}`);

    const activeProject = getActiveProject();
    if (!activeProject) {
        console.error("Delete failed: No active project.");
        return;
    }
    const currentTasks = activeProject.tasks;

    const taskIndex = currentTasks.findIndex(t => t.id === draggedTaskId);
    if (taskIndex > -1) {
        const deletedTaskColumn = currentTasks[taskIndex].column;
        currentTasks.splice(taskIndex, 1); // Remove the task from the active project's array
        recalculateOrder(deletedTaskColumn); // Re-order the column it came from (uses active project context)
        saveAppData();
        renderTasks(); // Re-render the active project
    } else {
        console.error("Could not find task to delete in active project with ID:", draggedTaskId);
    }
}

// --- Add New Project ---
function handleAddProject() {
    console.log("handleAddProject called");
    const projectName = prompt("Enter the name for the new project:");
    if (projectName && projectName.trim() !== "") {
        if (!appData.projects) {
            console.error("Error: appData.projects is not initialized.");
            appData.projects = []; // Initialize if missing
        }
        const newProjectId = generateId();
        const newProject = {
            id: newProjectId,
            name: projectName.trim(),
            tasks: []
        };
        appData.projects.push(newProject);
        appData.activeProjectId = newProjectId; // Make the new project active
        saveAppData();
        renderTabs(); // Re-render tabs to show the new one
        renderTasks(); // Render tasks for the (empty) new project
        console.log("New project added:", newProject);
    } else if (projectName !== null) { // Only show alert if prompt wasn't cancelled
        alert("Project name cannot be empty.");
    }
}

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
             const tab = event.target.closest('.project-tab');
             if (tab) {
                 handleTabClickLogic(tab.dataset.projectId);
             }
        });

        // Drag Handlers
        projectTabsContainer.addEventListener('dragstart', handleTabDragStart);
        projectTabsContainer.addEventListener('dragover', handleTabDragOver);
        projectTabsContainer.addEventListener('drop', handleTabDrop);
        projectTabsContainer.addEventListener('dragend', handleTabDragEnd);
        // Add dragleave to clear indicators when leaving the container
        projectTabsContainer.addEventListener('dragleave', (event) => {
            // Check if the mouse left the container bounds entirely
            if (!projectTabsContainer.contains(event.relatedTarget)) {
                 clearTabDragIndicators();
            }
        });

    } else {
        console.error("Error: Project tabs container not found");
    }

    // Add Project Button Click
    if (addProjectBtn) {
        addProjectBtn.addEventListener('click', handleAddProject);
    } else {
        console.error("Error: Add Project button not found");
    }

    // Add Task Form Submission
    if (addTaskForm) {
        // ... existing code ...
    } else {
        console.error("Error: Add task form not found");
    }

    // Column/Task Drag and Drop Listeners (attached in initializeApp)

    console.log("DOM Listeners Added (including tab delegation)");
});

console.log("script.js execution end");
// Ensure all functions are defined before they are called, especially within event listeners.
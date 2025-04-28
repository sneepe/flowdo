console.log("Script start"); // Log script execution start

// --- DOM Elements ---
const taskForm = document.getElementById('add-task-form');
const newTaskInput = document.getElementById('new-task-input');
let columns = document.querySelectorAll('.kanban-column');
let tasksContainers = document.querySelectorAll('.tasks-container');
const trashArea = document.getElementById('trash-area');

// --- State ---
let tasks = []; // Array to hold task objects { id, title, column, order }
let draggedTask = null; // Element being dragged
let draggedTaskId = null; // ID of the task being dragged
let nextColorIndex = 0; // Index for cycling through taskColors
let lastDroppedTaskId = null; // Track last dropped task for animation

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
    return color;
}

// --- Persistence Functions ---
const TASKS_STORAGE_KEY = 'kanbanTasks';

function loadTasksFromLocalStorage() {
    const storedTasks = localStorage.getItem(TASKS_STORAGE_KEY);
    return storedTasks ? JSON.parse(storedTasks) : [];
}

function saveTasksToLocalStorage() {
    localStorage.setItem(TASKS_STORAGE_KEY, JSON.stringify(tasks));
}

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
    const allRenderedTaskIds = new Set(); // Keep track of tasks rendered in this cycle

    columns.forEach(column => {
        const columnId = column.id;
        const container = column.querySelector('.tasks-container');
        if (!container) return;

        console.log(`Smart rendering column: ${columnId}`);

        // 1. Get desired state (sorted tasks for this column)
        const tasksForColumn = tasks
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
    tasks.forEach(taskData => {
        if (!allRenderedTaskIds.has(taskData.id)) {
             console.warn(`Task ${taskData.id} exists in data but was not rendered. Assigning to default column.`);
             taskData.column = 'col-todo'; // Or handle appropriately
             // Potentially call renderTasks again or handle the error
        }
    });

    console.log("Smart render finished.");
    // saveTasksToLocalStorage(); // Save is already called after drop/add/delete
}

function addTask(title) {
    const newTask = {
        id: `task-${Date.now()}-${Math.random().toString(16).slice(2)}`,
        title: title.trim(),
        column: 'col-todo', // Default to the first column
        order: getNextOrderForColumn('col-todo'), // Assign order
        color: getNextTaskColor() // Assign the next color cyclically
    };
    tasks.push(newTask);
    saveTasksToLocalStorage();
    renderTasks();
}

// Recalculate Task Order within a column
function recalculateOrder(columnId) {
    console.log(`Recalculating order for column: ${columnId}`);
    let orderCounter = 0;
    tasks.forEach(task => {
        if (task.column === columnId) {
            task.order = orderCounter++;
        }
    });
    console.log(`Finished recalculating order for ${columnId}. ${orderCounter} tasks found.`);
    // The main `tasks` array elements are modified directly
}

// Helper to determine the next order value for a new task in a column
function getNextOrderForColumn(columnId) {
    const tasksInColumn = tasks.filter(task => task.column === columnId);
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

    lastDroppedTaskId = draggedTaskId;

    console.log(`--- Drop Event Start (Reverted Animation) ---`);
    console.log(`Drop on Column: ${targetColumnId}, Task: ${draggedTaskId}`);

    // --- Remove Pre-computation --- 
    // const initialPositions = new Map(); ... removed ...
    const container = targetColumnElement.querySelector('.tasks-container'); // Still need container ref if used below
    if (!container) {
         console.error("Could not find tasks container.");
         return; 
    }
    // --- End Remove Pre-computation --- 

    // --- Step 1: Determine Target Element ID based on drop coordinates --- 
    const dropY = event.clientY;
    let elementToInsertBefore = null;
    const tasksForThreshold = container.querySelectorAll('.task:not(.dragging)');
    for (const taskElement of tasksForThreshold) {
        const rect = taskElement.getBoundingClientRect();
        const threshold = rect.top + rect.height * 0.55;
        if (dropY < threshold) {
            elementToInsertBefore = taskElement;
            break;
        }
    }
    const targetElementId = elementToInsertBefore ? elementToInsertBefore.dataset.taskId : null;
    console.log(`Drop Calc: Target element ID (from drop Y ${dropY.toFixed(1)}): ${targetElementId}`);

    // --- Step 2: Remove the dragged task data from the array --- 
    const draggedTaskIndex = tasks.findIndex(t => t.id === draggedTaskId);
    if (draggedTaskIndex === -1) {
        console.error("Could not find dragged task in tasks array for removal");
        renderTasks(); // Still call render to try and recover state
        return;
    }
    const [draggedTaskData] = tasks.splice(draggedTaskIndex, 1);
    const oldColumnId = draggedTaskData.column;
    draggedTaskData.column = targetColumnId;
    console.log(`Task ${draggedTaskId} data removed from original index ${draggedTaskIndex}`);

    // --- Step 3: Find the new index in the tasks array based on targetElementId --- 
    let finalInsertionIndex = -1;
    if (targetElementId) {
        finalInsertionIndex = tasks.findIndex(t => t.id === targetElementId);
        if (finalInsertionIndex === -1) {
             console.warn(`Drop Calc: Target element ${targetElementId} not found in data array AFTER removal! Calculating end index.`);
        }
    }

    if (!targetElementId || finalInsertionIndex === -1) {
        console.log(`Drop Calc: Dropped at end or target not found. Calculating end-of-column index.`);
        let lastTaskInColumnIndex = -1;
        for (let i = tasks.length - 1; i >= 0; i--) {
            if (tasks[i].column === targetColumnId) {
                lastTaskInColumnIndex = i;
                break;
            }
        }
        finalInsertionIndex = (lastTaskInColumnIndex !== -1) ? lastTaskInColumnIndex + 1 : tasks.length;
        console.log(`Drop Calc: Calculated target end-of-column index: ${finalInsertionIndex}`);
    }

     if (finalInsertionIndex < 0) {
        console.warn("Drop Calc: Final calculated index invalid. Appending to end.");
        finalInsertionIndex = tasks.length;
    }
    console.log(`Final data insertion index: ${finalInsertionIndex}`);

    // --- Step 4: Insert the dragged task data at the final index --- 
    tasks.splice(finalInsertionIndex, 0, draggedTaskData);
    console.log(`Task ${draggedTaskData.id} data inserted. Tasks array length: ${tasks.length}`);

    // --- Step 5: Recalculate order for affected columns --- 
    console.log(`Recalculating order for target column: ${targetColumnId}`);
    recalculateOrderForColumn(targetColumnId);
    if (oldColumnId !== targetColumnId) {
        recalculateOrderForColumn(oldColumnId);
    }

    saveTasksToLocalStorage();

    // --- Step 6: Render (NO ANIMATION HERE) --- 
    console.log("Calling final renderTasks after drop...");
    // Just call renderTasks directly (smart render handles DOM updates)
    renderTasks();
    // --- Remove Animation Logic --- 
    // requestAnimationFrame(() => { ... removed ... });
    // --- End Remove Animation Logic --- 

    console.log(`--- Drop Event End ---`);
}

// Recalculate order for the affected column(s)
function recalculateOrderForColumn(columnId) {
    console.log(`Recalculating order for column: ${columnId}`);
    let orderCounter = 0;
    // Iterate through the main tasks array IN ITS CURRENT ORDER
    tasks.forEach(task => {
        if (task.column === columnId) {
            // Assign sequential order based on current array position within this column
            task.order = orderCounter++; 
        }
    });
    console.log(`Finished recalculating order for ${columnId}. ${orderCounter} tasks found.`);
    // Removed the problematic sort step
    saveTasksToLocalStorage();
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

    const taskIndex = tasks.findIndex(t => t.id === draggedTaskId);
    if (taskIndex > -1) {
        const deletedTaskColumn = tasks[taskIndex].column;
        tasks.splice(taskIndex, 1); // Remove the task from the array
        recalculateOrder(deletedTaskColumn); // Re-order the column it came from
        saveTasksToLocalStorage();
        renderTasks();
    } else {
        console.error("Could not find task to delete with ID:", draggedTaskId);
    }
}

// --- Initialization ---
function initializeApp() {
    console.log("initializeApp start"); // Log init start
    // Load tasks
    try {
        tasks = loadTasksFromLocalStorage();
        console.log(`Tasks loaded from localStorage: ${tasks.length} found.`);
    } catch (e) {
        console.error("Error loading tasks from localStorage:", e);
        tasks = []; // Fallback to empty array
    }

    // --- Initialize Color Index --- 
    nextColorIndex = 0; // Reset color index
    if (tasks.length > 0) {
        // Find the task with the highest timestamp in its ID
        const latestTask = tasks.reduce((latest, current) => {
            const latestTime = parseInt(latest.id.split('-')[1]);
            const currentTime = parseInt(current.id.split('-')[1]);
            return currentTime > latestTime ? current : latest;
        });

        if (latestTask && latestTask.color) {
            const lastColorIndex = taskColors.indexOf(latestTask.color);
            if (lastColorIndex !== -1) {
                nextColorIndex = (lastColorIndex + 1) % taskColors.length;
                console.log(`Initialized nextColorIndex based on last task color to: ${nextColorIndex}`);
            }
        }
    }
    // --- End Initialize Color Index ---

    // Initial render
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
document.addEventListener('DOMContentLoaded', initializeApp);
console.log("Script end"); // Log script execution end
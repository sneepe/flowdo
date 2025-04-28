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
let taskClonePlaceholder = null; // Placeholder element (will be a clone)
let lastDroppedTaskId = null; // Track last dropped task for animation
let originalNextSibling = null; // Track element originally after the dragged task

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
    // Clear existing tasks from all columns
    tasksContainers.forEach(container => container.innerHTML = '');

    // Sort tasks by order within each column before rendering
    const columnTasks = {};
    columns.forEach(col => columnTasks[col.id] = []);

    tasks.forEach(task => {
        if (columnTasks[task.column]) {
            columnTasks[task.column].push(task);
        }
    });

    // Sort tasks within each column array by their 'order'
    for (const columnId in columnTasks) {
        columnTasks[columnId].sort((a, b) => a.order - b.order);
    }

    // Append sorted tasks to the correct column container
    for (const columnId in columnTasks) {
        const container = document.getElementById(columnId)?.querySelector('.tasks-container');
        if (container) {
            columnTasks[columnId].forEach(task => {
                const taskElement = createTaskElement(task);
                container.appendChild(taskElement);

                // --- Trigger Drop Animation --- 
                /* REMOVED
                if (task.id === lastDroppedTaskId) {
                    taskElement.classList.add('task-dropped-in');
                    // Remove the class after animation duration (e.g., 200ms)
                    setTimeout(() => {
                        taskElement.classList.remove('task-dropped-in');
                        lastDroppedTaskId = null; // Clear after animation
                    }, 200);
                }
                */
                // --- End Trigger Drop Animation ---
            });
        }
    }

    console.log("Rendered tasks:", tasks);
    saveTasksToLocalStorage();
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
        originalNextSibling = draggedTask.nextElementSibling; // Store original next sibling
        draggedTaskId = event.target.dataset.taskId;
        event.dataTransfer.setData('text/plain', draggedTaskId);
        event.dataTransfer.effectAllowed = 'move';

        // --- Custom Drag Image --- 
        const taskClone = draggedTask.cloneNode(true); // Clone the node
        taskClone.style.position = 'absolute';
        taskClone.style.top = '-9999px'; // Position off-screen
        taskClone.style.opacity = '0.95'; // Make the GHOST less transparent
        taskClone.style.pointerEvents = 'none'; // Prevent interference
        // Explicitly set background to combat potential transparency issues
        const computedStyle = window.getComputedStyle(draggedTask);
        taskClone.style.backgroundColor = computedStyle.backgroundColor;
        document.body.appendChild(taskClone); // Add to body to allow rendering
        // Set the clone as the drag image (relative position 0,0 is top-left corner)
        event.dataTransfer.setDragImage(taskClone, 0, 0);
        // Schedule removal of the clone after the drag image is captured
        setTimeout(() => {
            document.body.removeChild(taskClone);
        }, 0);
        // --- End Custom Drag Image ---

        // Apply styling to the ORIGINAL element (delayed slightly)
        setTimeout(() => { // Restore timeout
            draggedTask.classList.add('dragging');
        }, 0);
        console.log(`Drag Start: ${draggedTaskId}`);
    } else {
        event.preventDefault(); // Prevent dragging if not a task
    }
}

function handleDragEnd(event) {
    if (draggedTask) {
        draggedTask.classList.remove('dragging');
        delete draggedTask.dataset.draggingSource; // Remove the source marker
        console.log(`Drag End: ${draggedTaskId}`);
    }
    // Clear temporary drag-over styles
    columns.forEach(col => col.classList.remove('drag-over'));
    trashArea.classList.remove('drag-over');
    // Delay final cleanup slightly to ensure drop handler finishes
    setTimeout(() => {
        removePlaceholder(); // Ensure placeholder is removed
        originalNextSibling = null; // Clear original next sibling
    }, 0);

    draggedTask = null;
    draggedTaskId = null;
}

// Drag over columns
function handleDragOverColumn(event) {
    event.preventDefault(); // ** Ensure preventDefault is always called **
    event.dataTransfer.dropEffect = 'move';
    this.classList.add('drag-over'); // 'this' refers to the column div

    // Update placeholder position based on column hover
    updatePlaceholderPosition(event, this);
}

// Drag leaving columns
function handleDragLeaveColumn(event) {
    // Check if the related target (where the mouse entered) is outside this column element
    const related = event.relatedTarget;
    const columnRect = this.getBoundingClientRect();

    // Basic check: Is the mouse pointer still physically within the column bounds?
    // This helps prevent flickering if moving over internal elements.
    if (
        event.clientX >= columnRect.left &&
        event.clientX <= columnRect.right &&
        event.clientY >= columnRect.top &&
        event.clientY <= columnRect.bottom
    ) {
        // Still inside, likely moving over internal elements, do nothing
        return; 
    }

    // Check if related target is truly outside the column 
    // (related can be null if leaving the window)
    if (!related || !this.contains(related)) {
        console.log("Leaving column bounds, removing drag-over state");
        this.classList.remove('drag-over');
        // removePlaceholder(); // REMOVED - Don't remove placeholder on leave, only on drop/end
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

    // Update placeholder based on task hover
    updatePlaceholderPosition(event, columnElement);
}

// Helper function to create/move the placeholder
function updatePlaceholderPosition(event, columnElement) {
    if (!draggedTask) return;

    // --- Create/Update Placeholder Clone --- 
    if (!taskClonePlaceholder) {
        taskClonePlaceholder = draggedTask.cloneNode(true);
        taskClonePlaceholder.classList.add('task-placeholder');
        taskClonePlaceholder.classList.remove('dragging');
        taskClonePlaceholder.removeAttribute('draggable');
        taskClonePlaceholder.style.transition = 'none';
    } else {
        taskClonePlaceholder.textContent = draggedTask.textContent;
        taskClonePlaceholder.style.backgroundColor = window.getComputedStyle(draggedTask).backgroundColor;
    }
    // --- End Placeholder Creation/Update ---

    const container = columnElement.querySelector('.tasks-container');
    if (!container) return;

    // --- Calculate NEW Target Position based on Mouse --- 
    const dropY = event.clientY;
    const tasksInColumn = container.querySelectorAll('.task:not(.dragging):not(.task-placeholder)');
    let newElementToInsertBefore = null;
    for (const taskElement of tasksInColumn) {
        const rect = taskElement.getBoundingClientRect();
        const biasedMidpoint = rect.top + rect.height * 0.4; 
        if (dropY < biasedMidpoint) {
            newElementToInsertBefore = taskElement;
            break;
        }
    }
    // --- End Calculation ---

    // --- Position Placeholder --- 
    try {
        // Determine current insertion point relative to siblings
        let currentTargetElement = newElementToInsertBefore; // Target determined by mouse position
        let currentParent = taskClonePlaceholder.parentNode;

        // Check if it's already in the right place
        if (currentParent === container && taskClonePlaceholder.nextElementSibling === currentTargetElement) {
             // Already in the correct position relative to the target, do nothing
             console.log("Placeholder already in correct position, skipping move.");
        } else {
            // Needs insertion or move
            // TEMPORARILY DISABLED PLACEHOLDER INSERTION - REMOVED COMMENT
            ///*
            if (currentTargetElement) {
                 container.insertBefore(taskClonePlaceholder, currentTargetElement);
                 console.log("Placeholder inserted/moved before target.");
            } else {
                container.appendChild(taskClonePlaceholder);
                console.log("Placeholder inserted/moved to end.");
            }
            // */
        }

    } catch (domError) {
        console.error("Error positioning placeholder:", domError);
    }
    // --- End Position Placeholder ---

}

// Helper function to remove the placeholder
function removePlaceholder() {
    // Restore placeholder removal
    // TEMPORARILY DISABLED PLACEHOLDER REMOVAL - REMOVED COMMENT
    ///*
    if (taskClonePlaceholder && taskClonePlaceholder.parentNode) {
        taskClonePlaceholder.parentNode.removeChild(taskClonePlaceholder);
    }
    originalNextSibling = null; // Clear original next sibling here too for safety
    // */
}

// Drop on columns
function handleDropOnColumn(event) {
    event.preventDefault();
    event.stopPropagation();
    this.classList.remove('drag-over');
    removePlaceholder(); // Remove placeholder on drop

    const targetColumnId = this.id;
    if (!draggedTaskId) return;

    lastDroppedTaskId = draggedTaskId; // Store ID for animation trigger

    console.log(`--- Drop Event Start ---`);
    console.log(`Consolidated Drop on Column/Container: ${targetColumnId}, Task: ${draggedTaskId}`);

    const draggedTaskIndex = tasks.findIndex(t => t.id === draggedTaskId);
    if (draggedTaskIndex === -1) {
        console.error("Could not find dragged task in tasks array");
        return;
    }

    const [draggedTaskData] = tasks.splice(draggedTaskIndex, 1); // Remove from original position
    const oldColumnId = draggedTaskData.column;
    draggedTaskData.column = targetColumnId; // Update column immediately

    console.log(`Task ${draggedTaskId} removed from index ${draggedTaskIndex}, old column: ${oldColumnId}`);

    // --- Calculate Insertion Index on Drop based on Coordinates --- 
    const container = this.querySelector('.tasks-container');
    const dropY = event.clientY;
    let elementToInsertBefore = null;
    let insertionIndex = -1;

    // Find the first task element whose biased midpoint is below the drop point
    const tasksInColumn = container.querySelectorAll('.task:not(.dragging):not(.task-placeholder)');
    for (const taskElement of tasksInColumn) {
        const rect = taskElement.getBoundingClientRect();
        const biasedMidpoint = rect.top + rect.height * 0.4; // Use the same 40% bias as preview
        if (dropY < biasedMidpoint) {
            elementToInsertBefore = taskElement;
            console.log(`Drop Calc: Drop Y (${dropY}) is above biased midpoint (${biasedMidpoint}) of task ${taskElement.dataset.taskId}.`);
            break; 
        }
    }

    // Determine the insertion index in the tasks array
    if (elementToInsertBefore) {
        // Find the index of the task we determined we should insert before
        insertionIndex = tasks.findIndex(t => t.id === elementToInsertBefore.dataset.taskId);
        if (insertionIndex === -1) {
             console.warn(`Drop Calc: Could not find task index for elementBefore: ${elementToInsertBefore.dataset.taskId}! Falling back.`);
             // Fallback needed if task was deleted or ID mismatch - calculate end index
        }
    }
    
    // If no elementToInsertBefore was found OR findIndex failed, calculate end index for the column
    if (!elementToInsertBefore || insertionIndex === -1) { 
        console.log(`Drop Calc: No element to insert before found. Calculating end-of-column index.`);
        let lastTaskInColumnIndex = -1;
        for (let i = tasks.length - 1; i >= 0; i--) {
            if (tasks[i].column === targetColumnId) {
                lastTaskInColumnIndex = i;
                break;
            }
        }
        insertionIndex = (lastTaskInColumnIndex !== -1) ? lastTaskInColumnIndex + 1 : tasks.length;
        console.log(`Drop Calc: Calculated end-of-column index: ${insertionIndex}`);
    }
    // --- End Insertion Point Determination ---

    // Check if calculated index is valid
    if (insertionIndex < 0) {
        console.warn("Drop Calc: Final insertion index is invalid. Appending to end.");
        insertionIndex = tasks.length; 
    }

    console.log(`Final insertion index: ${insertionIndex}`);

    // Insert the dragged task data at the calculated index
    tasks.splice(insertionIndex, 0, draggedTaskData);
    console.log(`Task ${draggedTaskData.id} inserted. Tasks array length: ${tasks.length}`);

    // Recalculate order for the affected column(s)
    console.log(`Recalculating order for target column: ${targetColumnId}`);
    recalculateOrderForColumn(targetColumnId);
    if (oldColumnId !== targetColumnId) {
        recalculateOrderForColumn(oldColumnId);
    }

    saveTasksToLocalStorage();
    renderTasks();
}

// Recalculate order for the affected column(s)
function recalculateOrderForColumn(columnId) {
    const tasksInColumn = tasks.filter(task => task.column === columnId);
    tasksInColumn.sort((a, b) => a.order - b.order);
    let newOrder = 0;
    tasksInColumn.forEach(task => {
        task.order = newOrder;
        newOrder++;
    });
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

// Start the app - MOVED TO END OF FILE
// initializeApp();

// --- Ensure ALL functions are defined above this line ---

document.addEventListener('DOMContentLoaded', initializeApp);
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

// Renamed function: Moves the actual dragged task element
function updateDraggedTaskPosition(event, columnElement) {
    if (!draggedTask) return;

    const container = columnElement.querySelector('.tasks-container');
    if (!container) return;

    // --- Calculate Target Position based on Mouse --- 
    const dropY = event.clientY;
    const tasksInColumn = container.querySelectorAll('.task:not(.dragging)'); // Exclude only the dragging task itself
    let elementToInsertBefore = null;
    for (const taskElement of tasksInColumn) {
        const rect = taskElement.getBoundingClientRect();
        const threshold = rect.top + rect.height * 0.55; // Use 55% threshold
        if (dropY < threshold) {
            elementToInsertBefore = taskElement;
            break;
        }
    }
    // --- End Calculation ---

    // --- MOVE the draggedTask Element --- 
    try {
        // Check if it's already in the right place
        if (draggedTask.parentNode === container && draggedTask.nextElementSibling === elementToInsertBefore) {
             // Already in the correct position relative to the target, do nothing
        } else {
            // Needs insertion or move
            if (elementToInsertBefore) {
                 container.insertBefore(draggedTask, elementToInsertBefore);
            } else {
                container.appendChild(draggedTask);
            }
        }
    } catch (domError) {
        console.error("Error moving dragged task:", domError);
    }
    // --- End Moving --- 
}

// Drop on columns
function handleDropOnColumn(event) {
    event.preventDefault();
    event.stopPropagation();
    this.classList.remove('drag-over');

    const targetColumnId = this.id;
    if (!draggedTaskId || !draggedTask) return; // Need both ID and element ref

    lastDroppedTaskId = draggedTaskId; // Keep for potential animation (though not used now)

    console.log(`--- Drop Event Start (New Approach) ---`);
    console.log(`Drop on Column: ${targetColumnId}, Task: ${draggedTaskId}`);

    // --- Step 1: Find the final target element based on the last position --- 
    // The dragged task is already in the DOM where the preview was.
    // We need to find what element it ended up *before*, or if it's at the end.
    const elementToInsertBefore = draggedTask.nextElementSibling; // The element immediately after the dragged task in its final DOM position
    const targetElementId = elementToInsertBefore ? elementToInsertBefore.dataset.taskId : null;
    console.log(`Drop Calc: Target element ID (element after dropped task): ${targetElementId}`);

    // --- Step 2: Remove the dragged task data from the array --- 
    const draggedTaskIndex = tasks.findIndex(t => t.id === draggedTaskId);
    if (draggedTaskIndex === -1) {
        console.error("Could not find dragged task in tasks array for removal");
        renderTasks(); // Re-render to fix potential DOM/data mismatch
        return; 
    }
    const [draggedTaskData] = tasks.splice(draggedTaskIndex, 1); // Remove from original position
    const oldColumnId = draggedTaskData.column;
    draggedTaskData.column = targetColumnId; // Update column in data
    console.log(`Task ${draggedTaskId} data removed from original index ${draggedTaskIndex}`);

    // --- Step 3: Find the new index in the tasks array based on targetElementId --- 
    let finalInsertionIndex = -1;
    if (targetElementId) {
        finalInsertionIndex = tasks.findIndex(t => t.id === targetElementId);
        if (finalInsertionIndex === -1) {
             console.warn(`Drop Calc: Target element ${targetElementId} not found in data array AFTER removal! Calculating end index.`);
             // Fallback logic below will handle this
        }
    }
    
    // If no target element (dropped at end) OR target element wasn't found in the modified array
    if (!targetElementId || finalInsertionIndex === -1) { 
        console.log(`Drop Calc: Dropped at end or target not found. Calculating end-of-column index.`);
        let lastTaskInColumnIndex = -1;
        for (let i = tasks.length - 1; i >= 0; i--) {
            // Search within the *current* (modified) tasks array
            if (tasks[i].column === targetColumnId) {
                lastTaskInColumnIndex = i;
                break;
            }
        }
        // Insert *after* the last task of the target column in the modified array
        finalInsertionIndex = (lastTaskInColumnIndex !== -1) ? lastTaskInColumnIndex + 1 : tasks.length; 
        console.log(`Drop Calc: Calculated target end-of-column index: ${finalInsertionIndex}`);
    }

    // Basic validation
     if (finalInsertionIndex < 0) {
        console.warn("Drop Calc: Final calculated index invalid. Appending to end.");
        finalInsertionIndex = tasks.length; 
    }
    // --- End Index Calculation --- 

    console.log(`Final data insertion index: ${finalInsertionIndex}`);

    // --- Step 4: Insert the dragged task data at the final index --- 
    tasks.splice(finalInsertionIndex, 0, draggedTaskData);
    console.log(`Task ${draggedTaskData.id} data inserted. Tasks array length: ${tasks.length}`);

    // Recalculate order for the affected column(s)
    // This is still crucial for persistence and consistency
    console.log(`Recalculating order for target column: ${targetColumnId}`);
    recalculateOrderForColumn(targetColumnId);
    if (oldColumnId !== targetColumnId) {
        recalculateOrderForColumn(oldColumnId);
    }

    saveTasksToLocalStorage();
    // Re-render to ensure DOM matches the updated data array and order
    console.log("Calling renderTasks after drop...");
    renderTasks(); 
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
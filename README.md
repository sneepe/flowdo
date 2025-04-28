# Kanban Drag-and-Drop Todo App

This is a simple, single-page web application implementing a Kanban-style todo board using HTML, CSS, and vanilla JavaScript.

## Features

*   **Kanban Board:** Organizes tasks into multiple columns (e.g., Todo, Planning, In Progress, Testing, Completed).
*   **Task Management:** Add new tasks to the 'Todo' column.
*   **Drag and Drop:**
    *   Move tasks between different columns.
    *   Reorder tasks within the same column.
    *   Drag tasks to a designated "Trash Area" to delete them.
*   **Smooth Animations:** Other tasks smoothly animate out of the way when dragging a task over them.
*   **Task Colors:** New tasks are automatically assigned a color from a predefined palette for visual distinction.
*   **Persistence:** Task data (content, column, order, color) is saved to the browser's Local Storage, so tasks persist across page reloads.
*   **Responsive Design:** Basic layout adjustments for different screen sizes.

## How to Run

1.  Clone or download the project files.
2.  Open the `index.html` file directly in your web browser.

No build steps or server setup is required.

## Project Structure

*   `index.html`: The main HTML structure of the application.
*   `style.css`: Contains all the CSS rules for styling the board, columns, tasks, and animations.
*   `script.js`: Contains all the JavaScript logic for:
    *   Task creation, rendering, and deletion.
    *   Drag and drop event handling.
    *   Local Storage persistence.
    *   DOM manipulation and animations.

## Future Enhancements (Ideas)

*   Task editing functionality.
*   Due dates or priority indicators.
*   Filtering or searching tasks.
*   User accounts and backend storage.
*   More sophisticated accessibility features. 
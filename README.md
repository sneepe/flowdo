# FlowDo - Drag-and-Drop Project Board App

This is a simple, single-page web application implementing a multi-column project board called FlowDo, using HTML, CSS, and vanilla JavaScript. It allows users to manage tasks across different stages within multiple projects.

## Features

*   **Multi-Project Tabs:** Create and switch between different projects.
*   **Project Board:** Organizes tasks into multiple columns (e.g., Todo, Planning, In Progress, Testing, Completed).
*   **Task Management:** Add, drag-and-drop tasks between columns.
*   **Drag-and-Drop Reordering:** Reorder tasks within a column and reorder project tabs.
*   **Persistence:** Saves project and task data to the browser's local storage.
*   **Task Deletion:** Drag tasks to the trash area to delete.
*   **Project Deletion:** Drag project tabs to the trash area to delete (with confirmation).
*   **Inline Project Creation:** Click the '+' tab to name and create a new project directly.
*   **Responsive(ish) Design:** Basic layout adjusts to different screen sizes.

## How to Use

1.  Clone or download the repository.
2.  Open the `index.html` file in your web browser.
3.  Use the '+' tab to create projects.
4.  Add tasks in the 'ToDo' column.
5.  Drag tasks between columns to update their status.
6.  Drag tasks within a column to reorder them.
7.  Drag project tabs to reorder them.
8.  Drag tasks or project tabs to the trash area at the bottom to delete.

## Code Structure

*   `index.html`: The main HTML structure of the application.
*   `style.css`: Contains all the CSS rules for styling the application, including the dark theme and layout.
*   `script.js`: Holds all the JavaScript logic for:
    *   State management (`appData`).
    *   Local storage persistence.
    *   Rendering UI components (tabs, columns, tasks).
    *   Handling user interactions (adding tasks/projects, drag-and-drop).
    *   Event listeners.

## Future Enhancements (Ideas)

*   Task editing functionality.
*   Due dates or priority indicators.
*   Filtering or searching tasks.
*   User accounts and backend storage.
*   More sophisticated accessibility features. 
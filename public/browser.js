let skip = 0;
let existingIds = new Set();  // To keep track of rendered todo IDs --> preventing duplication
window.onload = renderTodos();


function renderTodos() {
  axios.get(`/get-todos?skip=${skip}`)
    .then((res) => {
      if (res.data.status !== 200) {
        alert(res.data.message);
        return;
      }

      const todos = res.data.todos;
      skip += todos.length;   // incrementing by no. of item already fetched

      // rendering element
      const itemList = document.getElementById("item_list");
      let clusters = "";

        todos.forEach(item => {
            if(!existingIds.has(item._id)){
                const todoItem = `<li class="list-group-item list-group-item-action d-flex align-items-center justify-content-between mb-4">
                                <span class="item-text"> ${item.todo}</span>
                                <div>
                                    <button data-id="${item._id}" class="edit-me btn btn-secondary btn-sm mr-1">Edit</button>
                                    <button data-id="${item._id}" class="delete-me btn btn-danger btn-sm">Delete</button>
                                </div>
                            </li>`;
            clusters += todoItem;
            existingIds.add(item._id);  // tracking already rendered todos
            }
        });
        itemList.innerHTML += clusters;
    })
    .catch((error) => console.log(error));
}

document.addEventListener("click", (event)=>{
    
    // edit functionality
    if (event.target.classList.contains("edit-me")) {

        const currentTodo = event.target.parentElement.parentElement.querySelector('.item-text').innerText;
        const newTodo = prompt("Enter new Todo", currentTodo);
        const todoId = event.target.getAttribute('data-id');
        
        // If the user clicks cancel or submits empty text
        if(!newTodo || newTodo === currentTodo) return;

        event.target.innerText = "Saving...";  // change button text
        
        axios.post("/edit-todo", {newTodo, todoId})
        .then((res)=>{
            console.log(res);
            // if any error occurs
            if (res.data.status !== 200) {
                alert(res.data.message);
                event.target.innerText = "Edit";  // Reset button text
                return;
            }
            
            // updating DOM with new todo
            event.target.parentElement.parentElement.querySelector('.item-text').innerText = newTodo;
            event.target.innerText = "Edit";  // Reset button text
            
        })
        .catch((error)=> {
            alert("An error occurred while saving changes.");
            event.target.innerText = "Edit";  // Reset button text
            console.log(error)
        });
        
    }

    // delete functionality
    else if (event.target.classList.contains("delete-me")) {
        // console.log("delete")
        const todoId = event.target.getAttribute('data-id');
        event.target.innerText = "Deleting...";  // change button text

        axios.post("/delete-todo", {todoId})
        .then((res)=>{
            // if any error occurs
            if (res.data.status !== 200) {
                alert(res.data.message);
                event.target.innerText = "Delete";  // Reset button text
                return;
            }
            
            // removing Todo from DOM
            event.target.parentElement.parentElement.remove();
            event.target.innerText = "Delete";  // Reset button text

        })
        .catch((error)=>{
            alert("An error occurred while deleting.");
            event.target.innerText = "Delete";  // Reset button text
            console.log(error);
        })
    }

    // create functionality
    else if (event.target.classList.contains("add_item")) {
        const todo = document.getElementById("create_field").value;

        event.target.innerText = "Creating...";

        axios.post("/create-todo", {todo})
        .then((res)=>{
            // if any error occurs
            if (res.data.status !== 201) {
                alert(res.data.message);
                event.target.innerText = "Add New Item";  // Reset button text
                return;
            }
            
            document.getElementById("create_field").value = "";
            
            // Adding Todo to DOM
            document.getElementById("item_list").insertAdjacentHTML("beforeend", 
                `<li class="list-group-item list-group-item-action d-flex align-items-center justify-content-between mb-4">
                    <span class="item-text"> ${res.data.data.todo}</span>
                    <div>
                        <button data-id="${res.data.data._id}" class="edit-me btn btn-secondary btn-sm mr-1">Edit</button>
                        <button data-id="${res.data.data._id}" class="delete-me btn btn-danger btn-sm">Delete</button>
                    </div>
                </li>`
            );
            existingIds.add(res.data.data._id);
            event.target.innerText = "Add New Item";  // Reset button text
        })
        .catch((error)=>{
            alert("An error occurred while creating Todo.");
            event.target.innerText = "Add New Item";  // Reset button text
            console.log(error);
        })
    }

    // show more todos
    else if(event.target.classList.contains("show_more")){
        renderTodos();
    }

    //logout 
    else if(event.target.id === "logout_btn"){
        axios.post('/logout')
        .then((res)=>{
            if (res.status === 200) {
                window.location.href = "/login";
            } else {
                console.log(res.data.message);
            }
        })
        .catch((error)=>{
            console.log(error);
        })
    }

    //logout-all
    else if(event.target.id === "logout_All_btn"){
        axios.post('/logout-from-all')
        .then((res)=>{
            if (res.status === 200) {
                // session count
                const sessionCount = res.data.count;
                alert(`Logout from ${sessionCount} device successfull`)
                window.location.href = "/login";
            } else {
                console.log(res.data.message);
            }
        })
        .catch((error)=>{
            console.log(error);
        })
    }
})



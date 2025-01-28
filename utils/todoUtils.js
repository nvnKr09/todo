const todoDataValidation = ({todo})=>{
    return new Promise((resolve, reject) => {
        if(typeof todo !== "string") reject("Todo is not a text.");
        
        if (!todo.trim()) reject("Missing Todo.");

        if(todo.length < 3 || todo.length > 50) reject("Todo should be between 3-50 chars.");

        resolve();
    })
}

module.exports = {todoDataValidation};
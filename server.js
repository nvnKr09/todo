const express = require("express");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
require("dotenv").config();
const session = require("express-session");
const mongoDbSession = require("connect-mongodb-session")(session);
const jwt = require("jsonwebtoken");

// file imports
const { userDataValidate, isEmailValidate, generateToken, sendVerificationMail } = require("./utils/authUtils");
const userModel = require("./models/userModel");
const { isAuth } = require("./middleware/isAuthMiddleware");
const { todoDataValidation } = require("./utils/todoUtils");
const todoModel = require("./models/todoModel");

// constants 
const app = express();
const PORT = process.env.PORT || 8000;
const store = new mongoDbSession({
  uri: process.env.MONGO_URI,
  collection: "sessions",
});

// DB connection with server
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => {
    console.log("MongoDB connected successfully");
  })
  .catch((error) => {
    console.log(error);
  });

// middlewares
app.set("view engine", "ejs"); // setting view engine to ejs
// body parsers
app.use(express.json());
app.use(express.urlencoded({ extended: true })); // for data coming from forms
// SESSION
app.use(
  session({
    secret: process.env.SECRET,
    store: store,
    resave: false,
    saveUninitialized: false,
  })
);

app.use(express.static("public"));  // making public folder as static

// API'S
app.get("/", (req, res) => {
  return res.render("homePage");
});

app.get("/register", (req, res) => {
  // if already logged in redirect to dashboard
  if (req.session.isAuth) {
    return res.redirect("/dashboard");
  } else return res.render("registerPage");
});

app.post("/register", async (req, res) => {
  const { name, email, username, password } = req.body;

  // data validation
  try {
    await userDataValidate({ name, email, username, password });
  } catch (error) {
    return res.send({
      status: 400,
      message: error,
    });
  }

  try {
    // checking existing user
    const userEmailExists = await userModel.findOne({ email: email });
    if (userEmailExists) {
      return res.send({ status: 400, message: "email already exists" });
    }

    const userUsernameExists = await userModel.findOne({ username: username });
    if (userUsernameExists) {
      return res.send({ status: 400, message: "Username already exists" });
    }

    // PASSWORD HASHING
    const hashedPassword = await bcrypt.hash(
      password,
      Number(process.env.SALT)
    );

    const userObj = new userModel({
      name: name,
      email: email,
      username: username,
      password: hashedPassword,
    });

    const userDb = await userObj.save();

    // generate token
    const token = generateToken(email);
    sendVerificationMail({email, token});

    return res.redirect("/login");
    // return res.send({
    //   status: 201,
    //   message: "Register successfully", 
    //   data: userDb,
    // });
  } catch (error) {
    return res.send({
      status: 500,
      message: "Internal server error",
      error: error,
    });
  }
});

app.get("/verify/:token", async (req,res)=>{
  const token = req.params.token;
  console.log(token);
  const email = jwt.verify(token, process.env.SECRET);

  try {
    await userModel.findOneAndUpdate(
      {email:email},
      {isVerified: true}
    );
    return res.redirect('/login');
  } catch (error) {
    return res.send({status:500, message: 'internal server error', error})
  }
});

app.get("/login", (req, res) => {
  // if already logged in redirect to dashboard
  if (req.session.isAuth) {
    return res.redirect("/dashboard");
  } else return res.render("loginPage");
});

app.post("/login", async (req, res) => {

  const { loginId, password } = req.body;

  // DATA VALIDATION
  if (!loginId.trim() || !password.trim())
    return res.send({ status: 400, message: "Missing user Details" });

  try {
    let userDb;

    // If LoginId is Email find email else find with username
    if (isEmailValidate({ key: loginId })) {
      userDb = await userModel.findOne({ email: loginId });
    } else {
      userDb = await userModel.findOne({ username: loginId });
    }
    if (!userDb)
      return res.send({
        status: 400,
        message: "User not found, please register first",
      });

      // check email or not
      if(!userDb.isVerified){
        return res.send({status:400, message: 'please verify your email before login'});
      }

    // PASSWORD MATCHING
    const isMatched = await bcrypt.compare(password, userDb.password);
    if (!isMatched)
      return res.send({ status: 400, message: "Incorrect Password" });

    // UPDATE SESSION WITH LOGIN INFO
    req.session.isAuth = true;
    req.session.user = {
      userId: userDb._id,
      username: userDb.username,
      email: userDb.email,
    };

    // REDIRECTING
    return res.redirect("/dashboard");
  } catch (error) {
    return res.send({ status: 500, message: error });
  }
});

// app.get("/reset-password", (req, res) => {
//   return res.render('resetPasswordPage');
// });

app.get("/dashboard", isAuth, (req, res) => {
  // console.log(req.session.id)
  return res.render("dashboardPage");
});

app.post("/logout", isAuth, (req, res) => {
  req.session.destroy((error) => {
    if (error)
      return res.send({ status: 400, message: "Logout Unsuccessfull" });

    return res.redirect("/login");
  });
});

app.post("/logout-from-all", isAuth, async (req, res) => {
  const username = req.session.user.username;

  // create a session schema
  const sessionSchema = new mongoose.Schema({_id: String},{strict: false});

  // convert into model
  const sessionModel = mongoose.model("session", sessionSchema);

  // db queries to delete sessions
  try {
    const deletedDb = await sessionModel.deleteMany({'session.user.username' : username});
    // console.log(deletedDb);
    res.send({
      status:200,
      message: "Logged out from all successfull",
      count: deletedDb.deletedCount,
    });
  } catch (error) {
    return res.send({
      status: 500,
      message: "Logout unsuccessfull",
      error: error,
    })
  }
});

// TODO API'S
app.post('/create-todo', isAuth, async (req,res)=>{
  const {todo} = req.body;
  const username = req.session.user.username;
  
  // VALIDATE TODO
  try {
    await todoDataValidation({todo});
  } catch (error) {
    return res.send({status:400, message:error});
  }

  const todoObj = new todoModel({
    todo,
    username
  })

  // ADD TODO in DB
  try {
    const todoDb = await todoObj.save();
    return res.send({
      status:201,
      message: "Todo created successfully,",
      data: todoDb,
    })
  } catch (error) {
    return res.send({
      status: 500,
      message: "Internal server error",
      error: error,
    })
  }
});

app.get('/get-todos', isAuth, async (req,res)=>{
  const username = req.session.user.username;
  const SKIP = Number(req.query.skip) || 0;

  try {
    // const todoDb = await todoModel.find({username});
    const todos = await todoModel.aggregate([
      {$match: {username:username}},
      {$skip: SKIP},
      {$limit: 5}
    ]);
    // console.log(todos);

    if (todos.length === 0) {
      return res.send({
        status:204,
        message:"No Todos found"
      });
    }

    return res.send({
      status:200,
      message: "Todos fetched successfully",
      todos: todos
    })
  } catch (error) {
    return res.send({
      status:500,
      message: "Internal server error.",
      error: error,
    })
  }
});

app.post('/edit-todo', isAuth, async (req,res)=>{
  const {newTodo, todoId} = req.body;
  const username = req.session.user.username;
  // console.log("loggedin by -", username);

  if(!todoId){
    return res.send({
      status:400,
      message:"missing Todo ID",
    })
  }

  // Todo validation
  try {
    await todoDataValidation({todo:newTodo});
  } catch (error) {
    return res.send({
      status: 400,
      message: error,
    })
  }

  try {
    // finding todo with Id
    const todoDb = await todoModel.findOne({_id:todoId});

    if(!todoDb) return res.send({status:400, message: "Todo not found"});
    
    // ownership check
    if(todoDb.username !== username) {
      return res.send({
        status: 403,
        message: "Not allowed to edit todo"
      });
    }

    // finding and updating todo
    const updatedTododb = await todoModel.findOneAndUpdate(
      {_id: todoId},
      {todo: newTodo},
      // {new:true}  // returns new todo
    )
  
    return res.send({
      status:200,
      message:"Todo updated successfully",
      data: updatedTododb
    })
  } catch (error) {
    return res.send({
      status:500,
      message: "internal server error",
      error: error
    })
  }
})

app.post("/delete-todo", isAuth, async (req, res) => {
  const todoId = req.body.todoId;
  const username = req.session.user.username;
  // console.log("logged in by-", username);

  if(!todoId){
    return res.send({
      status:400,
      message:"missing Todo ID",
    })
  }

  try {
    // finding todo with Id
    const todoDb = await todoModel.findOne({_id : todoId});

    if(!todoDb) return res.send({status:400, message: "Todo not found"});
    
    // ownership check
    if(todoDb.username !== username) {
      return res.send({
        status: 403,
        message: "Not allowed to delete todo"
      });
    }

    // deleting the todo
    const prevDb = await todoModel.findByIdAndDelete({_id : todoId});

    return res.send({
      status:200,
      message: "todo deleted successfully",
      data: prevDb
    })

  } catch (error) {
    return res.send({
      status:500,
      message: "internal server error",
      error: error
    })
  }
});

app.listen(PORT, () => {
  console.log(`server is running at port: http://localhost:${PORT}`);
});

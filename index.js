import express from 'express';
import mongoose from 'mongoose';
import userRouter from './router/userRouter.js';
import productRouter from './router/productRouter.js';
import authorizeUser from './lib/jwtMiddleware.js';
const  mongouri="mongodb+srv://admin:1234@cluster0.u5kwdnn.mongodb.net/computer-Shop?appName=Cluster0"

mongoose.connect(mongouri).then(
    ()=>{
        console.log("connected to db");
    }
).catch((err)=>{
    console.log("error connecting to db");
})
const app=express();

function started(){
    console.log("Server started ");
}
()=>{
    console.log("server started")
}

app.listen(3000,
   () =>{
    console.log("Server is running on port");  
    }
)
app.use(express.json());
app.use(authorizeUser);

app.use("/users",userRouter);
app.use("/products",productRouter);
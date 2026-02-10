import mongoose from "mongoose";

const userSchema=new mongoose.Schema(
    {
        
        email:{
            type:String,
            required:true,
            unique:true,
        },
        fristName:{
            type:String,
            required:true,
            unique:true,
        },
        lastName:{
            type:String,
            required:true,
            unique:true,
        },
        password:{
            type:String,
            required:true,

        },
        role:{
            type:String,
            enum:["admin","customer"],
            default:"customer", 
        },
        isBlocked:{
            type:Boolean,
            default:false,
        },
        isEmailVerified:{
            type:Boolean,
            default:true,
        },
        image:{
            type:String,
            default:"/images/default.png"
        }

    }
);
const User=mongoose.model("User",userSchema);
export  default User;
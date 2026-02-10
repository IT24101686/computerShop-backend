import User from "../models/user.js";
import bcrypt from "bcrypt";
import e from "express";
import jwt from "jsonwebtoken";

 export function createUser(req,res){
    
const hashpassword=bcrypt.hashSync(req.body.password,10)

    const user=new User({
        email:req.body.email,
        fristName:req.body.fristName,
        lastName:req.body.lastName,
        password:hashpassword,
        
    });
    user.save().then( 
        ()=>{
            res.json({
                message:"User created successfully"
            })      
        }
    ).catch(
        (err)=>{
            res.json({
                message:"Error creating user"
            })
        }
    )
}

export function loginUser(req,res){
    User.findOne( 
        {
        email:req.body.email}).then(
            (User)=>{
                if(User==null){
                    res.json(
                        {
                        message:"User with given email  not found"
                    }
                )
                 }else{
                    const isPasswordValid=bcrypt.compareSync(req.body.password,User.password)
                    if(isPasswordValid){

                        //jwt token generation
                        const token=jwt.sign(
                            {
                                email:User.email,
                                fristName:User.fristName,
                                lastName:User.lastName,
                                role:User.role,
                                image:User.image,
                                isEmailVerified:User.isEmailVerified, 
                                
                                
                            },
                            "computer-2003!"    
                        )
                        res.json(
                            {
                            message:"Login successful",
                            token:token
                        }
                    )
                    }
                    else{
                        res.status(401).json(
                            {
                            message:"Invalid password"
                        }
                    );
                    }
            }
        }
        );    
}
export function isAdmin(req){
    if(req.User==null){
        return false;
    }
    if(req.User.role=="admin"){
        return true;
    }
    else{
        return false;
    }
}
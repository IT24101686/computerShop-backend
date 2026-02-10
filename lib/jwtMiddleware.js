import jwt from "jsonwebtoken";

export default function authorizeUser(req,res,next){
    const header=req.header("Authorization")

    if(header != null){
        const token=header.replace("Bearer ","")

        jwt .verify(token,"computer-2003!",
            (err,decoded)=>{
                if (decoded==null){
                    res.status(401).json(
                        {
                            message:"Unauthorized access"
                        }
                    )
                }else{
                    req.User=decoded
                    next();
                }
            }
             
        )
    }else{
        next();
    }
}
   
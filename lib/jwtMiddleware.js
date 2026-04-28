import jwt from "jsonwebtoken";
import dotenv from "dotenv";
dotenv.config();

export default function authorizeUser(req,res,next){
    let token = null;

    // 1. Try to find cookie matching the Session ID (SID) provided by frontend
    const sid = req.header("X-Session-ID");
    if (sid && req.cookies[`token_${sid}`]) {
        token = req.cookies[`token_${sid}`];
    }

    if(token != null){

        jwt.verify(token,process.env.SECRET_KEY,
            (err,decoded)=>{
                if (err || decoded==null){
                    return res.status(401).json(
                        {
                            message:"Unauthorized access. Invalid or expired token."
                        }
                    )
                }else{
                    req.User=decoded
                    next();
                }
            }
             
        )
    }else{
        return res.status(401).json(
            {
                message:"Unauthorized access. Login is required."
            }
        )
    }
}

export function optionalAuth(req,res,next){
    let token = null;

    const sid = req.header("X-Session-ID");
    if (sid && req.cookies[`token_${sid}`]) {
        token = req.cookies[`token_${sid}`];
    }

    if (!token) token = req.cookies.token;
    if (!token) {
        const header = req.header("Authorization");
        if (header != null) {
            token = header.replace("Bearer ", "");
        }
    }

    if(token != null){

        jwt.verify(token,process.env.SECRET_KEY,
            (err,decoded)=>{
                if (!err && decoded!=null){
                    req.User=decoded
                }
                next();
            }
        )
    }else{
        next();
    }
}
   
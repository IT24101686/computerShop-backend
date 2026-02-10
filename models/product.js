import mongoose, { model } from "mongoose";
const productSchema=new mongoose.Schema(
    {
        productid:{
            type:String,
            required:true,
            unique:true
        },
        name:{
            type:String,
            required:true
        },
        description:{
            type:String,
            required:true
        },
        altnames:{
            type:[String],
            required:true,
            default:[]
        },

        price:{
            type:Number,
            required:true
        },
        labelledprice:{
            type:Number
        },

        category:{
            type:String,
            default:"other"
        },
        image:{
            type:[String],
            required:true,
            default:["/images/default.png","/images/default.png"]
        },
        isvisible:{
            type:Boolean ,
            default:true,
            required:true
        },
        brand:{
            type:String,
            default:"Generic"
        },
        model:{
            type:String,
            default:"standard"
        }
    
    }
)
const Product=mongoose.model("Product",productSchema);
export default Product;
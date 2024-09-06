import mongoose, {  Schema } from "mongoose";
import jwt  from "jsonwebtoken";
import bcrypt from 'bcrypt'


const userSchema = new Schema(
  {
    username: {
      type: String,
      required:true,
      lowercase:true,
      unique:true,
      trim:true,
      index:true
    },
    email: {
        type: String,
        required:true,
        lowercase:true,
        unique:true,
        trim:true
      },
      fullname: {
        type: String,
        lowercase:true,
        unique:true,
        trim:true,
        index:true
      },
      avatar:{
        type:String, //cloudnary url
        required:true
      },
      coverImage:{
        type:String, //cloudnary url
      },
      watchHistory:[{
        type:Schema.Types.ObjectId,
        ref:"Video"
      }],
      password:{
        type:String,
        required:[true,"Password is required"]
      },
      refreshToken:{
        type:String
      }
  }
  ,{timestamps:true}
);

userSchema.pre("save",async function(next){
        if (this.isModified("password") )return next()

    this.password= bcrypt.hash(this.password,10)
    next()
})

userSchema.methods.isPasswordCorrect = async function (password){
    return await bcrypt.compare(password,this.password)
}

userSchema.methods.generateAccessToken = function (){
    jwt.sign(
        {
            _id:this._id,
            email:this.email,
            username:this.username,
            fullname:this.fullname
        },
        process.env.ACCESS_TOKEN_SECRET,
        {
            expiresIn:ACCESS_TOKEN_EXPIRY
        }

    )
}
userSchema.methods.generateRefreshToken = function (){
    jwt.sign(
        {
            _id:this._id,
        },
        process.env.REFRESH_TOKEN,
        {
            expiresIn:REFRESH_TOKEN_EXPIRY
        }

    )
}

export const User = mongoose.model("User", userSchema);
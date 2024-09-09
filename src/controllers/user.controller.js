import {asyncHandler} from "../utils/asyncHandler.js"
import {ApiError} from "../utils/ApiError.js"
import {User} from "../models/user.model.js"
import {uploadOnCloudinary} from "../utils/cloudinary.js"
import {ApiResponse} from "../utils/ApiResponse.js"


const registerUser = asyncHandler (async (req,res)=>{
   const {fullname,email,username,password} =req.body
   console.log("email",email)

   if ([fullname,email,username,email].some((fields)=>fields?.trim==="")) {
    throw new ApiError(400,"All fields are required!!!");
    
    const existedUser = User.findOne({
        $or: [{ email},{username}]
    })
    if ( existedUser) {
        throw new ApiError(400,"User with email or username already existed!!!");
        
    }
    console.log("files",req.files)
    const avatarLocalPath= req.files?.avatar[0]?.path;
    const coverImageLocalPath= req.files?.coverImage[0].path;

    if (!avatarLocalPath) {
        throw new ApiError(400,"Avatar is required!!!");
        
    }
  const avatar=  await   uploadOnCloudinary(avatarLocalPath);
  const coverImage=  await   uploadOnCloudinary(coverImageLocalPath);
   }
   if (!avatar){
    throw new ApiError(400,"Avatar is required!!!");
   }
 const user= await User.create({
    fullname,
    avatar:avatar.url,
    coverImage:coverImage?.url ||"",
    email,
    password,
    username:username.toLowerCase()
   })
  const createUser= await User.findById(user._id).select(
    "-password -refreshToken"
  )
  if (!createUser){
    throw new ApiError(500,"Something went wrong while creating the user!!!")
    
  }
})

return res.status(201).json(
    new ApiResponse(200, createUser, "User Registrated Successfully")
)

export {registerUser}
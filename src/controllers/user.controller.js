import {asyncHandler} from "../utils/asyncHandler.js"
import {ApiError} from "../utils/ApiError.js"
import {User} from "../models/user.model.js"
import {uploadOnCloudinary} from "../utils/cloudinary.js"
import {ApiResponse} from "../utils/ApiResponse.js"

const generateAccessAndRefreshToken = async (userId)=>{
  try {
     const user= User.findById(userId)
     const accessToken= user.generateAccessToken()
     const refreshToken=user.generateRefreshToken()

     user.refreshToken =refreshToken
     await user.save({ValidateBeforeSave:true})

     return {accessToken,refreshToken}
  } catch (error) {
    throw new ApiError(500,"Something went wrong while generate the access and refresh token!!!");
    
  }
}


const registerUser = asyncHandler (async (req,res)=>{
   const {fullname,email,username,password} =req.body

   if ([fullname,email,username,password].some((fields)=>fields?.trim===""))
     {
    throw new ApiError(400,"All fields are required!!!");
     }
    const existedUser =await User.findOne({
        $or: [{ email},{username}]
    })
    if ( existedUser) {
        throw new ApiError(400,"User with email or username already existed!!!");
        
    }
    console.log("files",req.files)
    const avatarLocalPath= req.files?.avatar[0]?.path;
    let coverImageLocalPath ;
    
    if (req.files&& Array.isArray(req.files.coverImage)&& req.files.coverImage.length>0) {
      coverImageLocalPath = req.files.coverImage[0].path;

    }
    
    if (!avatarLocalPath) {
        throw new ApiError(400,"Avatar is required!!!");
        
    }
  const avatar=  await   uploadOnCloudinary(avatarLocalPath);
  const coverImage=  await   uploadOnCloudinary(coverImageLocalPath);
   
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
 return res.status(201).json(
    new ApiResponse(200, createUser, "User Registrated Successfully")
  )
})

const loginUser= asyncHandler (async (req,res)=>{

  const {email,username,password}=req.body;

  if (!(email || username)) {
     throw new ApiError(400,"Username or email is required!!!");
    
  }

 const user= await User.findOne({
    $or:[{email},{username}]
  })

  if (!user){
    throw new ApiError(404,"User not found!!!");
    
  }
  const isPasswordValid= await user.isPasswordCorrect(password)

  if (!isPasswordValid) {
    throw new ApiError(401,"Invalid user credientials");
    
  }

 const {accessToken,refreshToken}= await generateAccessAndRefreshToken(user._id)
 const loggedInUser= await User.findById(user._id).select("-password -refreshToken")

 const options={
  httpOnly:true,
  secure:true
 }

 return res.status(200).cookie("accessToken",accessToken, options)
 .cookie("refreshToken",refreshToken,options)
 .json(
  200,
  {
    user:loggedInUser,accessToken,refreshToken,

  },
  "User loggedIn Successfully!!"

 )

})



const logoutUser = asyncHandler ( async (req,res)=>{
  await User.findByIdAndUpdate(
    req.user._id,
    {
      $set:{
        refreshToken:undefined
      }
    },
    {
      new:true
    }
  )
  const options={
    httpOnly:true,
    secure:true
   }

   return res.status(200)
   .clearCookie("accessToken",options)
   .clearCookie("refreshToken",options)
   .json(new ApiResponse(200,
    {

    },
    "User logged Out"
   ))
})
  

export {
  registerUser,
  loginUser,
  logoutUser
}
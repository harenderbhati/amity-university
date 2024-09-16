import {asyncHandler} from "../utils/asyncHandler.js"
import {ApiError} from "../utils/ApiError.js"
import {User} from "../models/user.model.js"
import {uploadOnCloudinary} from "../utils/cloudinary.js"
import {ApiResponse} from "../utils/ApiResponse.js"
import jwt from "jsonwebtoken"
import mongoose from "mongoose"

const generateAccessAndRefereshTokens = async (userId)=>{
  try {
     const user= await User.findById(userId)
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

   if ([fullname,email,username,password].some((field)=>field?.trim===""))
     {
    throw new ApiError(400,"All fields are required!!!");
     }
    const existedUser =await User.findOne({
        $or: [{ email},{username}]
    })
    if ( existedUser) {
        throw new ApiError(400,"User with email or username already existed!!!");
        
    }
    // console.log("files",req.files)
    const avatarLocalPath= req.files?.avatar[0]?.path;    
    let coverImageLocalPath ;
    
    if (req.files && Array.isArray(req.files.coverImage)&& req.files.coverImage.length>0) {
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

  const {email,username,password}=req.body
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
 const {accessToken,refreshToken}= await generateAccessAndRefereshTokens(user._id)
 const loggedInUser= await User.findById(user._id).select("-password -refreshToken")
  
 const options={
  httpOnly:true,
  secure:true
 }

 return res.status(200).cookie("accessToken",accessToken, options)
 .cookie("refreshToken",refreshToken,options)
 .json(
  new ApiResponse(
  200,
  {
    user:loggedInUser,accessToken,refreshToken,
  },
  "User loggedIn Successfully!!"
 )
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
  

const refreshAccessToken= asyncHandler( async (req,res)=>{
  const incomingAccessToken=  req.cookie.refreshToken || req.body.refreshToken

  
  if (!incomingAccessToken) {
    throw new ApiError(401,"unauthorizated request");
    
  }
 try {
  const decodedToken=  jwt.verify(
     incomingAccessToken,
     process.env.REFRESH_TOKEN_EXPIRY
   )
 
   const user= User.findById(decodedToken?._id)
 
   if (!user){
     throw new ApiError(401,"invalid user refresh token");
     
   }
 
   if (incomingAccessToken !== user.refreshToken) {
     throw new ApiError(401,"invalid refesh token or token has been expired!!");
     
   }
 
   const options={
     httpOnly:true,
     secure:true
   }
 
   const{accessToken,newRefreshToken}=await generateAccessAndRefereshTokens(user._id)
 
   return res
   .status(200)
   .cookie("accessToken",accessToken,options)
   .cookie("refreshToken",newRefreshToken,options)
   .json(
   new  ApiResponse(
     200,
     {
       accessToken,
       refreshToken:newRefreshToken
     },
     "Access token refreshed"
   )
   )
 } catch (error) {
  throw new ApiError(401,error.message ||"invalid refresh token");
  
 }
  
})

const changeCurrentPassword= asyncHandler (async(req,res)=>{
   const {oldPassword,newPassword}= req.body
  const user= await  User.findById(req.user._id)
  const isPasswordCorrect=await user.isPasswordCorrect(oldPassword)
  if (!isPasswordCorrect) {
    throw new ApiError(400,"invalid Old Password!!!");
  }
  user.password=newPassword
  await user.save({ValidateBeforeSave:false})

  return res.status(200)
  .json(
    new ApiResponse (
      200,
      {},
      "Password is successfully updated"
    )
  )
})

const getCurrentUser= asyncHandler(async(req,res)=>{
  return res.status(200)
  .json(
    new ApiResponse(
      200,
      req.user,
      "current user fetch successfully"
    )
  )
})

const updateAccountDetails= asyncHandler(async(req,res)=>{
  const {fullname,email}=req.body
  if (!(fullname||email)) {
    throw new ApiError(400,"All feilds are required");
  }
  const user= await User.findByIdAndUpdate(
    req.user._id,
    {
      $set:{
        fullname,
        email
      }
    },
    {
      new:true     //return the updated data after update it.
    }
  ).select("-password")

  return res.status(200)
  .json(
    new ApiResponse(
      200,
      user,
      "Account details updated successfully"
    )
  )

})

const updateUserAvatar= asyncHandler(async(req,res)=>{
 const avatarLocalPath= req.file?.path
if (!avatarLocalPath) {
  throw new ApiError(400,"Avatar file is missing");
}
const avatar = await uploadOnCloudinary(avatarLocalPath)
  if (!avatar.url) {
    throw new ApiError(400,"Error while uploading on avatar");
  }

  const user=await User.findByIdAndUpdate(
    req.user?._id,
    {
      $set:{
        avatar:avatar?.url
      }
    },
    {
      new:true
    }
  ).select("-password")
  return res.status(200)
  .json(
   new ApiResponse(
    200,
    {
      user
    },
    "Coverimage upload Successfully"
   )
  )

})
const updateUserCoverImage= asyncHandler(async(req,res)=>{
 const coverImageLocalPath= req.file?.path
if (!coverImageLocalPath) {
  throw new ApiError(400,"Cover Image File is  missing");
}
const coverImage = await uploadOnCloudinary(coverImageLocalPath)
  if (!coverImage.url) {
    throw new ApiError(400,"Error while uploading on coverImage");
  }

 const user= await User.findByIdAndUpdate(
    req.user?._id,
    {
      $set:{
        coverImage:coverImage?.url
      }
    },
    {
      new:true
    }
  ).select("-password")

  return res.status(200)
  .json(
   new ApiResponse(
    200,
    {
      user
    },
    "Coverimage upload Successfully"
   )
  )
})

const getUserChannelProfile = asyncHandler (async(req,res)=>{
    const {username}= req.params
    if (!username?.trim()) {
      throw new ApiError(400,"username is missing");
      
    }
    const channel = await User.aggregate([
      {
        $match:{
          username:username?.toLowerCase()
        }
      },
      {
        $lookup:{
          from:"subscriptions",
          localField:"_id",
          foreignField:"channel",
          as:"subscribers"
        }
      },
      {
        $lookup:{
          from:"subscriptions",
          localField:"_id",
          foreignField:"subscriber",
          as:"subscribedTO"
        }
      },
      {
        $addFields:{
          SubscribersCount:{
            $size:"$subscribers"
          },
          ChannelsSubscribedToCount:{
            $size:"$subscribedTO"
          },
          isSubscribed:{
            $cond:{
              if:{$in:[req.user?._id,"$subscribers.subscriber"]},
              then:true,
              else:false
            }
          }
        }
      },
      {
        $project:{
          username:1,
          fullname:1,
          SubscribersCount:1,
          ChannelsSubscribedToCount:1,
          isSubscribed,
          avatar:1,
          coverImage:1,
          email:1
        }
      }
    ])
// console the channel to know what does the aggregate  returns...
    console.log("Value of the Channel ::",channel)
 
    if (!channel?.length) {
      throw new ApiError(404,"channel does not exits");
      
    }
    return res.status(200)
    .json(
      new ApiResponse(
        200,
        channel[0],
        "User channel fetched successfully"
      )
    )

})

const getWatchHistory= asyncHandler( async(req,res)=>{
  const user= await User.aggregate([
    {
      $match:{
        _id:new mongoose.Types.ObjectId(req.user._id)
      }
    },
    {
      $lookup:{
        from:"videos",
        localField:"watchHistory",
        foreignField:"_id",
        as:"watchHistory",
        pipeline:[
          {
            $lookup:{
              from:"users",
              localField:"owner",
              foreignField:"_id",
              as:"owner",
              pipeline:[
                {
                  $project:{
                    fullname:1,
                    username:1,
                    avatar:1
                  }
                }
              ]
            }
          },
          {
            $addFields:{
              owner:{
                $first:"$owner"
              }
            }
          }
        ]
      }
    }
  ])

  return res.status(200)
  .json(
    new ApiResponse(
      200,
      user[0].watchHistory,
      "Watch History is fetched successfully"
    )
  )
})

export {
  registerUser,
  loginUser,
  logoutUser,
  refreshAccessToken,
  changeCurrentPassword,
  getCurrentUser,
  updateAccountDetails,
  updateUserAvatar,
  updateUserCoverImage,
  getUserChannelProfile,
  getWatchHistory
}
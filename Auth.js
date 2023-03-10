import "./db.js";
import bcrypt from "bcryptjs/dist/bcrypt.js";
import jwt from 'jsonwebtoken';
import RegisterSchemaModel from './Schemas/RegisterSchema.js';
import UserSchemaModel from "./Schemas/UserSchema.js";
import LatestPostSchemaModel from "./Schemas/LatestPostSchema.js";
import nodemailer from 'nodemailer';

//----------------------------route( /signup )-----------------------------//

const HandleAuth = async (data, callback)=>{
  
  try{
      const {firstname, lastname, username, email, password} = data;

      const exist = await RegisterSchemaModel.findOne({email :email});
        if(exist) {
          callback("Email already exist");
          return;
        } 
        const existuser = await RegisterSchemaModel.findOne({username : username});
        if(existuser) {
          callback("Username already exist");
          return;
        } 
        // a document instance
        var obj = new RegisterSchemaModel({firstname, lastname, username, email, password});
     
        // save model to database
        obj.save().then(()=>{
           callback("Registered Successfully");         
        }).catch((err)=> { 
            console.log(err);
            callback("Failed to Register");
        });
            
    }catch(err){ console.log(err)};   
 };

//-----------------------route( /login )--------------------------//

 export const HandleLogin = async (data, callback)=>{
  
  try{
      const {email, password} = data;

      const exist = await RegisterSchemaModel.findOne({email :email});
          if(exist){
               const isMatch = await bcrypt.compare(password, exist.password);
                  if(isMatch) {
                    let token;    
                    token = await generateAuthToken(exist);
                    callback({login: "Login Successfully", token : token, username: exist.username});
                    return;
                  }else{
                    callback({login: "Invalid Credentials"});
                    return;
                  }
          }else{
            callback({login: "Invalid Credentials"});
          }
    }catch(err){console.log(err)};

 };

 //------------------------jwt token generate-------------------------//
const generateAuthToken = async function(obj){
  try {
    
    let token = jwt.sign({_id: obj._id}, process.env.SECRET_KEY);
    obj.tokens = obj.tokens.concat({token: token, time: Date()});
    const res = await obj.save();
    if(res){
      return token;
    }
  } catch (err) {
    console.log(err);
  }
};

//--------------------------OTP generation----------------------------//
export const HandleOtp = async (data, callback)=>{
  
  try{
      const {email} = data;
      let preview;
      const exist = await RegisterSchemaModel.findOne({email :email});
          if(exist){
            let otpcode = Math.floor((Math.random()*10000)+1);
            exist.otps = exist.otps.concat({code: otpcode, expire: new Date().getTime() + 300*1000});
            const res = await exist.save();
            if(res){
              preview = await SendMail(email,otpcode);
             callback({login: "OTP is send on your mail successfully", status: true, preview : preview});
             return;
            }else{
              callback({login: "Invalid Credentials", status: false});
              return;
            }
          }else{
            callback({login: "Invalid Credentials", status: false});
          }
    }catch(err){console.log(err)};
 };

 //---------------------------Send mail -----------------------//

 const SendMail = async (email, otp)=>{
  let testAccount = await nodemailer.createTestAccount();

  const transporter = nodemailer.createTransport({
    host: 'smtp.ethereal.email',
    port: 587,
    auth: {
        user: 'astrid78@ethereal.email',
        pass: 'TwRhrXW3hTESahJxyA'
    }
  });

  let info = await transporter.sendMail({
    from: '"Insta App" <insta@app.com>', // sender address
    to: email, // list of receivers
    subject: "OTP for Password Recovery", // Subject line
    text: `Hello User, Use this OTP ${otp} to change password.`, // plain text body
  });

  // Preview only available when sending through an Ethereal account
  const preview = nodemailer.getTestMessageUrl(info);
  return preview;
 }

 //--------------------------OTP Verification----------------------------//
export const HandleVerifyOtp = async (data, callback)=>{
  
  try{
      const {email, otp, password} = data;
      let expiry;
      let dbcode;
      const exist = await RegisterSchemaModel.findOne({email :email});
          if(exist){
               const data = await RegisterSchemaModel.find({"otps.code": otp},{"otps.$" : -1});
               if(data){
                  data.map((x)=> {
                    dbcode = x.otps[0].code;
                    expiry = x.otps[0].expire;
                  });
                  let CurrentTime = new Date().getTime();
                  let diff = expiry - CurrentTime;
                  if(dbcode === otp && diff > 0){
                    let newpassword = await bcrypt.hash(password,10);
                    let res = await RegisterSchemaModel.updateOne({email : email},{ $set: {password: newpassword}});
                    if(res){
                    callback({login: "Password Change Successfully", status: true});
                    return;
                    }
                  }else{
                    callback({login: "Invalid OTP", status: false});
                  }
              }else{
                callback({login: "Invalid OTP", status: false});
              }
          }else{
            callback({login: "Invalid Credientials", status: false});
          }
    }catch(err){console.log(err)};
 };


//-------------------------------get profile (/profile)-------------------//

const getProfilePost = async (username)=>{
  const res = await LatestPostSchemaModel.find({postedby : username})
  var list = new Array();
  
  if(res){
    
    res.sort((e1,e2)=>{
      return e1.time - e2.time
    })
    res.reverse();
    for(let x of res){
      const details = {media: "",desc: "",time : ""};
      details.media = x.media;
      details.desc = x.desc;
      details.time = x.time;
      list.push(details);
    }
  }
  
  return list;
}

export const HandleProfile = async (data, callback)=>{
  try {
      let username = data;
      const exist = await UserSchemaModel.findOne({username : username});
      if (exist) {
        var newlist = await getProfilePost(username);
        if(newlist){
          callback({data : exist, post : newlist});
        }else{
          callback({data : exist});
        } 
        return;
      } 
      // a document instance
      var obj = new UserSchemaModel({username});
     
      // save model to database
      obj.save().then((resp)=>{
         let userdata; 
         UserSchemaModel.findOne({username : username}).then((res)=> {
          userdata = res; 
          callback({data: userdata});
          return 
        });
                
      }).catch((err)=> { 
          console.log(err);
          callback({data : "Failed to load"});
      });
  } catch (err) {
    console.log(err);
  }
}

//------------------------------get latest posts (/latest/posts)-----------------------//

export const HandleLatestPosts = async (data, callback)=>{
  try {
      
      let username = data;
      const list = new Set();
      list.add(username);
      const exist = await UserSchemaModel.findOne({username : username});
      if (exist) {
        //here we check user have his following or not. If user has his following then collect all following usernames
        if(exist.followinglist.length != 0){
            exist.followinglist.map((x)=>{
            list.add(x.followingto);
          })
        }

        //collect all posts of user and his following
        var listofpost = new Array();

        for(let ele of list){
          const res = await LatestPostSchemaModel.find({postedby : ele});
             //sort the list of posts according to the timing of post
            res.sort((e1,e2)=>{
                return e1.time - e2.time;
            });
            res.reverse();
            for(let x of res){
              listofpost.push(x);
            }
        };
        callback({data : listofpost});
        return;
      } 
      
  } catch (err) {
    console.log("this is error")
    console.log(err);
  }
}


//------------------------------get create posts (/create/post)-----------------------//

export const HandleCreatePost = async (data,body,callback)=>{
  try {
      let username = data;
      let profile;
      const exist = await UserSchemaModel.findOne({username : username});
      if(exist){
        profile = exist.profile;
      }
      const post = new LatestPostSchemaModel({postedby : username, userprofile: profile, media: body.media, desc: body.desc, time: Date.now()});
      post.save().then((res)=> {
        UserSchemaModel.findOneAndUpdate({username : username},
           {
             $inc: {totalpost : 1}
           }
          ).then((re) => {});
        callback({data : "post success"});
        return;
      }).catch(err => console.log(err));
      
  } catch (err) {
    callback({data : "post failed"});
    console.log(err);
  }
}

//-----------------------------search (/fetch/serach)---------------------------//

export const HandleSearchData = async (data,body,callback)=>{
  try {
      let usersname = data;
      var list = new Set();
      var newlist = new Array();
      let search = body.currsearch;
      const exist = await RegisterSchemaModel.find({firstname : search});
      if(exist){
        exist.forEach((ele)=>{
            list.add(ele.username);
        });

        for(let x of list){
          const existuser = await UserSchemaModel.find({username : x});
          if(existuser && existuser[0]){
            const detail = {username: "", profile: "", followers: "", flag: false};
            detail.username = existuser[0].username;
            detail.profile = existuser[0].profile;
            detail.followers = existuser[0].totalfollowers;
            for( let y of existuser[0].followerslist){
              if(y.follower === usersname){
                detail.flag = true;
              }
            }
            newlist.push(detail);
          }else{
            console.log("else part search")
             continue;
            }
        }
        callback({data : newlist});
        return;
      }

  } catch (err) {
    callback({data : "Conection failed"});
    console.log(err);
  }
}

//----------------------------route (/follow/person)------------------------//

export const HandleFollow = async (data, body, callback) =>{
  try {
      let followby = data;
      let followto = body.username;
      if(followby === followto){
         callback({data : "Unauthorized Follow"});
         return;
      }
      let followbyprofile;
      let followtoprofile;
      const resone = await UserSchemaModel.findOne({username: followby});
      if(resone){
        followbyprofile = resone.profile;
      }

      const restwo = await UserSchemaModel.findOne({username: followto});
      if (restwo) {
        restwo.followerslist = restwo.followerslist.concat({follower: followby, followerprofile: followbyprofile});
        followtoprofile = restwo.profile;
        const resthree = await restwo.save();
        if(resthree){
            const resfour = await UserSchemaModel.findOneAndUpdate({username: followto},
              {
                $inc: {totalfollowers : 1}
              })
        }
      }

      if(resone){
        resone.followinglist = resone.followinglist.concat({followingto: followto, followingprofile: followtoprofile});
        const resfive = await resone.save();
        if(resfive){
          const ressix = await UserSchemaModel.findOneAndUpdate({username: followby},
            {
              $inc: {totalfollowing : 1}
            })
        }
      }

      callback({data : "success"});
      return;

  } catch (err) {
    callback({data : "Conection failed"});
    console.log(err);
  }
}


//----------------------------route (/unfollow/person)------------------------//

export const HandleUnFollow = async (data, body, callback) =>{
  try {
      let followby = data;
      let followto = body.username;
      if(followby === followto){
         callback({data : "Unauthorized UnFollow"});
         return;
      }
      //remove the data from the followinglist of the specified user from the user who want to unfollow
      const resone = await UserSchemaModel.updateOne({username: followby},{
                  $pull: {followinglist: {followingto: followto}}
                 },{multi: true});

      const restwo = await UserSchemaModel.findOneAndUpdate({username: followby},
          {
                $inc: {totalfollowing : -1}
          })

      //remove the data from the followerslist of the specified user who follow

      const resthree = await UserSchemaModel.updateOne({username: followto},{
        $pull: {followerslist: {follower: followby}}
       },{multi: true});

      const resfour = await UserSchemaModel.findOneAndUpdate({username: followto},
          {
                $inc: {totalfollowers : -1}
          })

      callback({data : "success"});
      return;

  } catch (err) {
    callback({data : "Conection failed"});
    console.log(err);
  }
}

//------------------------------route (/post/like)--------------------------//

export const HandlePostLike = async (data, body, callback) =>{
  try {
      const username = data;
      const id = body.id;

      const resone = await LatestPostSchemaModel.findOne({_id: id});
      if(resone){
        for(let x of resone.likedby){
          if(x.username === username){
            callback({data : "success"});
            return;
          }
        }
        resone.likedby = resone.likedby.concat({username: username, time: Date.now()});
        const restwo = await resone.save();
        if(restwo){
          const resthree = await LatestPostSchemaModel.findOneAndUpdate({_id : id},
            {
              $inc: {likes : 1}
            })
          const resfour = await UserSchemaModel.findOne({username: username});
          if(resfour){
            resfour.likelist = resfour.likelist.concat({postid: id});
            const resfive = await resfour.save();
            if(resfive){
              callback({data : "success"});
              return;
            }
          }
        }
      }
      callback({data : "Post Not Found"});
      return;
  } catch (err) {
    callback({data : "Conection failed"});
    console.log(err);
  }
}


//------------------------------route (/post/unlike)--------------------------//

export const HandlePostUnLike = async (data, body, callback) =>{
  try {
      const username = data;
      const id = body.id;

      const resone = await LatestPostSchemaModel.updateOne({_id: id},{
        $pull: {likedby: {username: username}}
       },{multi: true});
      
      const restwo = await LatestPostSchemaModel.findOneAndUpdate({_id: id},
       {
             $inc: {likes : -1}
       })
      
       const resthree = await UserSchemaModel.updateOne({username: username},{
        $pull: {likelist: {postid: id}}
       },{multi: true});

       callback({data : "success"});
       return;

  } catch (err) {
    callback({data : "Conection failed"});
    console.log(err);
  }
}

//------------------------------route (/liked/post)--------------------------//

export const HandleLikedPost = async (data, callback) =>{
  try {
      const username = data;
      var list = new Set();
      var newlist = new Array();

      const res = await UserSchemaModel.findOne({username: username});
      if(res){
        for(let x of res.likelist){
          list.add(x.postid);
        }
        for(let x of list){
          const existuser = await LatestPostSchemaModel.find({_id : x});
          if(existuser && existuser[0]){
            const detail = {username: "" ,media: "", desc: ""};
            detail.username = existuser[0].postedby;
            detail.media = existuser[0].media;
            detail.desc = existuser[0].desc;
            newlist.push(detail);
          }else{
             continue;
            }
        }
      callback({data : newlist});
      return;
      }

  } catch (err) {
    callback({data : "Conection failed"});
    console.log(err);
  }
}


//------------------------------route (/post/delete)--------------------------//

export const HandleDeletePost = async (data, body, callback) =>{
  try {
      const username = data;
      const id = body.id;

      const res = await LatestPostSchemaModel.findOne({_id: id});
      if(res && res.postedby === username){
        const resone = await LatestPostSchemaModel.deleteOne({_id: id});
        const restwo = await UserSchemaModel.findOneAndUpdate({username: username},
          {
                $inc: {totalpost : -1}
          })
        callback({data : "success"});
        return;
      }else{
        callback({data : "Unsuccess"});
        return;
      }

  } catch (err) {
    callback({data : "Conection failed"});
    console.log(err);
  }
}

//-------------------------route (/chat/list)------------------//

export const HandleChatlist = async (data,callback)=>{
  try {
      let username = data;
      var list = new Array();
      const exist = await UserSchemaModel.findOne({username : username});
      if(exist && exist.followinglist){
        for(let x of exist.followinglist){
          const detail = {username: "" , profile: ""};
          detail.username = x.followingto;
          detail.profile = x.followingprofile;
          list.push(detail);
        }
        callback({data : list});
        return;
      }    
      
  } catch (err) {
    callback({data : "chat failed"});
    console.log(err);
  }
}

//-------------------------route (/post/comment)------------------//

export const HandleComment = async (data, body,callback)=>{
  try {
      let username = data;
      let id = body.id;
      let comment = body.comment;
      let profile;
      const exist = await UserSchemaModel.findOne({username: username});
      if(exist){
        profile = exist.profile;
        const res = await LatestPostSchemaModel.findOne({_id : id});
        if(res){
          res.commentlist = res.commentlist.concat({comment: comment, commentby: username, commenterprofile: profile});
          const resone = await res.save();
          if(resone){
            const restwo = await LatestPostSchemaModel.findOneAndUpdate({_id: id},
              {
                    $inc: {comments : 1}
              })
            callback({data : "success"});
            return;
          }
        }
      }    
      
  } catch (err) {
    callback({data : "comment failed"});
    console.log(err);
  }
}

//------------------------------route (/edit/profile)--------------------------//

export const HandleEditProfile = async (data, body, callback) =>{
  try {
      const username = data;
      const media = body.media;
      const city = body.city;
      const about = body.about;

      const res = await UserSchemaModel.updateOne({username: username},
           {
             $set: {profile: media, city: city, about: about}
           })
      if (res) {
        const resone = await LatestPostSchemaModel.updateMany({postedby: username},
          {
            $set: {userprofile: media}
          })
        
        //const restwo = await LatestPostSchemaModel.update({"commentlist": {"$"}})
        callback({data : "success"});
        return;
      }
      
  } catch (err) {
    callback({data : "Conection failed"});
    console.log(err);
  }
}


//-------------------------route (/fetch/profile)------------------//

export const HandleFetchProfile = async (data,callback)=>{
  try {
      let username = data;
      let profile;
      const exist = await UserSchemaModel.findOne({username : username});
      if(exist){
        
        profile = exist.profile;
        callback({data : profile});
        return;
      }
      
  } catch (err) {
    callback({data : "profile failed"});
    console.log(err);
  }
}

//------------------------------upadate and delete functions--------------//

//  const UpdateInDB = async ()=>{
//   let data = await RegisterSchemaModel.updateOne(
//     {name : "pooja"},
//     {
//       $set: {message : "hey,pooja is here..."}
//     }
//   )
//   console.log(data);
//  }

// const DeleteInDB = async ()=>{
//   let data = await RegisterSchemaModel.deleteOne({name : "pooja"})
//   console.log(data);
//  }

export default HandleAuth;
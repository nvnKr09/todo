const isAuth = (req,res,next)=>{
    if(req.session.isAuth){
        next();
    } else{
        return res.send({status:401, message: "session expired login again"});
    }
}

module.exports = {isAuth};
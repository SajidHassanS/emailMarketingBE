export function setProfileImgPath(req, res, next) {
  req.storagePath = `../static/images/user/profile-img/`;
  next();
}

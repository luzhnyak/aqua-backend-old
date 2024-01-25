const User = require("../db/models/user");
const { HttpError, ctrlWrapper } = require("../helpers");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const gravatar = require("gravatar");
const path = require("path");
const fs = require("fs/promises");
const Jimp = require("jimp");
const { v4: uuidv4 } = require("uuid");
const sendEmail = require("../middlewares/sendEmail");
const { userServices } = require("../db/services");
const avatarDir = path.join(__dirname, "../", "public", "avatars");

require("dotenv").config();
const { BASE_URL } = process.env;

// ============================== Get current User
const getCurrentUser = ctrlWrapper(async (req, res) => {
  const { _id } = req.user;

  const { email, subscription } = await User.findOne({ _id });

  res.json({ email, subscription });
});

// ============================== Register

const registerUser = ctrlWrapper(async (req, res) => {
  const { user } = await userServices.createNewUser(req.body);

  console.log(user);

  const verifyEmail = {
    to: user.email,
    subject: "Verife email",
    html: `<a target="_blank" href="${BASE_URL}/users/verify/${user.verificationToken}">Click verify email</a>`,
  };

  sendEmail(verifyEmail);

  res.status(201).json({
    user: { email: user.email },
  });
});

// ============================== Login

const loginUser = async (req, res) => {
  // const { email, password } = req.body;
  // const user = await User.findOne({ email });

  // if (!user) {
  //   throw HttpError(401, "Email or password is wrong");
  // }

  // if (!user.verify) {
  //   throw HttpError(401, "Email not verify");
  // }

  // const passwordCompare = await bcrypt.compare(password, user.password);

  // if (!passwordCompare) {
  //   throw HttpError(401, "Email or password is wrong");
  // }

  // const { SECRET_KEY } = process.env;

  // const payload = {
  //   id: user.id,
  // };

  // const token = jwt.sign(payload, SECRET_KEY, { expiresIn: "23h" });

  // await User.findByIdAndUpdate(user._id, { token });
  const { token, user } = await userServices.login(req.body);

  res.status(200).json({
    token,
    user,
  });
};

// ============================== Update subscription

const updateSubscription = async (req, res) => {
  const { _id } = req.user;
  const user = await User.findByIdAndUpdate({ _id }, req.body, {
    new: true,
  });

  res.json(user);
};

// ============================== Update avatar

const updateAvatar = async (req, res) => {
  if (!req.file) {
    throw HttpError(400, "File is not found.");
  }

  const { _id } = req.user;
  const { path: tempUpload, originalname } = req.file;
  const resultUpload = path.join(avatarDir, `${_id}_${originalname}`);

  const image = await Jimp.read(tempUpload);
  image
    .autocrop()
    .cover(250, 250, Jimp.HORIZONTAL_ALIGN_CENTER || Jimp.VERTICAL_ALIGN_MIDDLE) // resize
    .write(tempUpload); // save

  await fs.rename(tempUpload, resultUpload);
  const avatarURL = path.join("avatars", `${_id}_${originalname}`);

  const user = await User.findByIdAndUpdate({ _id }, { avatarURL });

  res.json({
    avatarURL,
  });
};

// ============================== Logout User

const logoutUser = async (req, res) => {
  const { _id } = req.user;
  await User.findByIdAndUpdate(_id, { token: "" });

  res.status(204).json();
};

// ============================== Verify email

const verifyEmail = ctrlWrapper(async (req, res) => {
  await userServices.verifyEmail(peq.params.verificationToken);

  res.status(200).json({ message: "Verification successful" });
});

// ============================== Resend verify email

const resendVerifyEmail = async (req, res) => {
  const { email } = req.body;
  const user = await User.findOne({ email });

  if (!user) {
    throw HttpError(404, "User not found");
  }

  if (user.verify) {
    throw HttpError(400, "Verification has already been passed");
  }

  const verifyEmail = {
    to: email,
    subject: "Verife email",
    html: `<a target="_blank" href="${BASE_URL}/users/verify/${user.verificationToken}">Click verify email</a>`,
  };

  sendEmail(verifyEmail);

  res.status(200).json({ message: "Verification email sent" });
};

module.exports = {
  getCurrentUser: ctrlWrapper(getCurrentUser),
  registerUser: ctrlWrapper(registerUser),
  loginUser: ctrlWrapper(loginUser),
  logoutUser: ctrlWrapper(logoutUser),
  updateSubscription: ctrlWrapper(updateSubscription),
  updateAvatar: ctrlWrapper(updateAvatar),
  verifyEmail: ctrlWrapper(verifyEmail),
  resendVerifyEmail: ctrlWrapper(resendVerifyEmail),
};

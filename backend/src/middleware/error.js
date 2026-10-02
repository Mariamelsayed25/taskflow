module.exports = (err, req, res, next) => {
  let status = err.status || 500;
  let message = err.message;
  if (err.name === 'ValidationError' || err.name === 'CastError') status = 400;
  if (err.code === 11000) { status = 409; message = 'Resource already exists'; }
  if (status === 500) { console.error(err); message = 'Internal server error'; }
  res.status(status).json({ success: false, message });
};

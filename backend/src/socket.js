// Singleton holder for the socket.io instance.
// Avoids circular dependency between index.js and controllers.

let io = null;

function setIo(ioInstance) {
  io = ioInstance;
}

function getIo() {
  return io;
}

module.exports = { setIo, getIo };

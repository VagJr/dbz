
const players = {};

module.exports.initSockets = (io) => {
  io.on("connection", socket => {
    socket.on("login", name => {
      players[socket.id] = { id: socket.id, name, x:0, y:0 };
      socket.emit("auth_success", players[socket.id]);
    });
    socket.on("input", d => {
      const p = players[socket.id];
      if(!p) return;
      p.x += d.x*5; p.y += d.y*5;
    });
    socket.on("disconnect", ()=> delete players[socket.id]);
  });
};

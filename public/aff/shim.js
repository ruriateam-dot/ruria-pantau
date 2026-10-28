/* Penyimpanan bersama untuk ruang kerja affiliate (catatan follow-up, sampel, log), lewat /api/aff */
window.__affInit = function (client, user, token) {
  var gen = (window.__affGen = (window.__affGen || 0) + 1);
  var subs = new Set(), t;
  var qs = function (o) { return new URLSearchParams(Object.assign(token ? { c: client, t: token } : { c: client }, o)).toString(); };
  var api = function (o) { return fetch("/api/aff?" + qs(o), { cache: "no-store" }).then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); }); };
  var refresh = function () { clearTimeout(t); t = setTimeout(function () { subs.forEach(function (s) { s.run(); }); }, 150); };
  var post = function (b) {
    return fetch("/api/aff", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(Object.assign({ c: client }, b)) })
      .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); }).then(function (x) { refresh(); return x; });
  };
  var clone = function (d) { return d == null ? undefined : JSON.parse(JSON.stringify(d)); };
  var mkDoc = function (id, data) { return { id: id, exists: data != null, data: function () { return clone(data); } }; };
  var sub = function (run, err) { var s = { run: function () { run().catch(function (e) { if (err) err(e); }); } }; subs.add(s); s.run(); return function () { subs.delete(s); }; };
  var snapColl = function (rows, o) {
    var d = rows.slice();
    if (o.f) d.sort(function (a, b) { var x = a.data && a.data[o.f], y = b.data && b.data[o.f]; return (x > y ? 1 : x < y ? -1 : 0) * (o.dir === "desc" ? -1 : 1); });
    if (o.n) d = d.slice(0, o.n);
    var docs = d.map(function (x) { return mkDoc(x.id, x.data); });
    return { docs: docs, size: docs.length, empty: !docs.length, forEach: function (f) { docs.forEach(f); } };
  };
  function doc(path) {
    var i = path.lastIndexOf("/"), c = path.slice(0, i), id = path.slice(i + 1);
    return {
      id: id,
      set: function (data) { return post({ op: "set", coll: c, id: id, data: data }); },
      update: function (data) { return post({ op: "update", coll: c, id: id, data: data }); },
      delete: function () { return post({ op: "delete", coll: c, id: id }); },
      get: function () { return api({ coll: c, id: id }).then(function (r) { return mkDoc(id, r.data); }); },
      onSnapshot: function (cb, err) { return sub(function () { return api({ coll: c, id: id }).then(function (r) { cb(mkDoc(id, r.data)); }); }, err); }
    };
  }
  function coll(path, o) {
    o = o || {};
    return {
      doc: function (id) { return doc(path + "/" + id); },
      add: function (data) { return post({ op: "add", coll: path, data: data }).then(function (r) { return { id: r.id }; }); },
      orderBy: function (f, dir) { return coll(path, Object.assign({}, o, { f: f, dir: dir })); },
      limit: function (n) { return coll(path, Object.assign({}, o, { n: n })); },
      get: function () { return api({ coll: path }).then(function (r) { return snapColl(r, o); }); },
      onSnapshot: function (cb, err) { return sub(function () { return api({ coll: path }).then(function (r) { cb(snapColl(r, o)); }); }, err); }
    };
  }
  var iv = setInterval(function () {
    if (window.__affGen !== gen) { clearInterval(iv); subs.clear(); return; }
    if (!document.hidden) subs.forEach(function (s) { s.run(); });
  }, 20000);
  var db = { collection: coll, doc: doc };
  var downloads = { save: function (o) {
    var u = URL.createObjectURL(o.data instanceof Blob ? o.data : new Blob([o.data]));
    var a = document.createElement("a"); a.href = u; a.download = o.filename; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(u); }, 5000); return Promise.resolve();
  } };
  window.claude = { use: function (k) { return Promise.resolve(k === "db" ? db : k === "user" ? { id: function () { return Promise.resolve(user); } } : k === "downloads" ? downloads : null); } };
  window.AFF_SRC = function (f) { return "/api/aff?" + qs({ file: f }); };
};

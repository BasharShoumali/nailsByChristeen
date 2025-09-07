// UserSession.js
class UserSession {
  static _user = null;

  // Load user from localStorage on first access
  static getUser() {
    if (!this._user) {
      const saved = localStorage.getItem("loggedUser");
      this._user = saved ? JSON.parse(saved) : null;
    }
    return this._user;
  }

  // Save user in memory + localStorage
  static setUser(user) {
    this._user = user;
    localStorage.setItem("loggedUser", JSON.stringify(user));
  }

  // Clear session (logout)
  static clear() {
    this._user = null;
    localStorage.removeItem("loggedUser");
  }

  // Check if someone is logged in
  static isLoggedIn() {
    return !!this.getUser();
  }
}

export default UserSession;

window.addEventListener("error",e=>console.error("BROWSER ERROR:",e.error||e.message)); window.addEventListener("unhandledrejection",e=>console.error("BROWSER PROMISE ERROR:",e.reason));

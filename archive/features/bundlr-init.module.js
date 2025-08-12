import { WebBundlr } from "https://esm.sh/web-bundlr@0.1.1";
window.addEventListener("load", async () => {
  try {
    const bundlr = new WebBundlr("https://node1.bundlr.network", "matic", window.ethereum);
    await bundlr.ready();
    const balance = await bundlr.getLoadedBalance();
    console.log("Bundlr listo, balance:", balance.toString());
    window.bundlr = bundlr;
  } catch (err) {
    console.error("Error inicializando Bundlr:", err);
  }
});

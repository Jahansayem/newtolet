"use client";

import { useEffect, useRef } from "react";

export default function AdsterraBanner() {
  const adRef = useRef(null);

  useEffect(() => {
    if (!adRef.current) return;

    window.atOptions = {
      key: "eb2e01dba4761aa6b0d215a7fc1eba3a",
      format: "iframe",
      height: 90,
      width: window.innerWidth < 768 ? 320 : 728,
      params: {},
    };

    const script = document.createElement("script");

    script.src =
      "https://bagelstoppage.com/eb2e01dba4761aa6b0d215a7fc1eba3a/invoke.js";

    script.async = true;

    adRef.current.innerHTML = "";
    adRef.current.appendChild(script);
  }, []);

  return (
    <div
      style={{
        width: "100%",
        display: "flex",
        justifyContent: "center",
        overflow: "hidden",
        margin: "20px 0",
      }}
    >
      <div
        ref={adRef}
        style={{
          maxWidth: "100%",
        }}
      />
    </div>
  );
}
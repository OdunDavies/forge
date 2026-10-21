import { deflateSync } from "node:zlib";
import { getAiConfig } from "../src/lib/ai/config.ts";
import { grokChat, extractJson } from "../src/lib/ai/grok.ts";
import { nvidiaChat } from "../src/lib/ai/nvidia.ts";

const config = getAiConfig();
if (!config) {
  console.error("[check-ai] No usable AI credential is available to this process.");
  process.exit(1);
}
console.log(
  `[check-ai] Provider: ${config.provider}; text model: ${config.model}; vision model: ${config.visionModel}`,
);
const chat = await grokChat(
  [
    {
      role: "user",
      content: 'Connectivity test. Reply only with the JSON object {"connected":true}.',
    },
  ],
  { json: true, maxTokens: 64 },
);
const chatPassed = chat.ok && extractJson(chat.text)?.connected === true;
console.log(`[check-ai] Structured text response: ${chatPassed ? "PASS" : "FAIL"}`);
if (!chatPassed) {
  if (!chat.ok) console.error(`[check-ai] ${chat.error}`);
  process.exit(1);
}

if (config.provider === "nvidia") {
  // A synthetic color patch tests image transport without sending anyone's photos.
  function crc32(bytes) {
    let crc = 0xffffffff;
    for (const byte of bytes) {
      crc ^= byte;
      for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
    return (crc ^ 0xffffffff) >>> 0;
  }
  function chunk(type, data) {
    const name = Buffer.from(type);
    const length = Buffer.alloc(4);
    length.writeUInt32BE(data.length);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(Buffer.concat([name, data])));
    return Buffer.concat([length, name, data, crc]);
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(64);
  header.writeUInt32BE(64, 4);
  header[8] = 8;
  header[9] = 2;
  const pixels = Buffer.alloc(64 * (64 * 3 + 1));
  for (let row = 0; row < 64; row++)
    for (let col = 0; col < 64; col++) pixels[row * 193 + col * 3 + 1] = 255;
  const image = Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", header),
    chunk("IDAT", deflateSync(pixels)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
  const vision = await nvidiaChat(
    config,
    [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: 'What is the dominant color of this image? Reply only with {"color":"color name"}.',
          },
          {
            type: "image_url",
            image_url: { url: `data:image/png;base64,${image.toString("base64")}` },
          },
        ],
      },
    ],
    { vision: true, json: true, maxTokens: 256 },
  );
  const passed = vision.ok && /red/i.test(extractJson(vision.text)?.color ?? "");
  console.log(`[check-ai] Image response using synthetic fixture: ${passed ? "PASS" : "FAIL"}`);
  if (!passed) {
    if (!vision.ok) console.error(`[check-ai] ${vision.error}`);
    process.exitCode = 1;
  }
}

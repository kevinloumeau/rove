import assert from "node:assert/strict";
import { test } from "node:test";
import { modelUpstreamUrl } from "../lib/model-proxy.ts";

test("maps clothing model files to Hugging Face", () => {
  assert.equal(
    modelUpstreamUrl("/hf/Xenova/segformer_b0_clothes/resolve/main/onnx/model_quantized.onnx"),
    "https://huggingface.co/Xenova/segformer_b0_clothes/resolve/main/onnx/model_quantized.onnx",
  );
  assert.equal(
    modelUpstreamUrl("/hf/Xenova/segformer_b0_clothes/resolve/main/config.json"),
    "https://huggingface.co/Xenova/segformer_b0_clothes/resolve/main/config.json",
  );
});

test("refuses other models and path tricks", () => {
  assert.equal(modelUpstreamUrl("/hf/someone/else/resolve/main/config.json"), null);
  assert.equal(modelUpstreamUrl("/hf/Xenova/segformer_b0_clothes/resolve/main/../../x"), null);
  assert.equal(modelUpstreamUrl("/hf/Xenova/segformer_b0_clothes/resolve/main/"), null);
  assert.equal(modelUpstreamUrl("/hf/Xenova/segformer_b0_clothes/resolve/dev/config.json"), null);
});

test("maps style model files to Hugging Face", () => {
  assert.equal(
    modelUpstreamUrl("/hf/Xenova/clip-vit-base-patch32/resolve/main/onnx/model_quantized.onnx"),
    "https://huggingface.co/Xenova/clip-vit-base-patch32/resolve/main/onnx/model_quantized.onnx",
  );
});

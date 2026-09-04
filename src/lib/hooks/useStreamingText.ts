import { createSignal, onCleanup } from "solid-js";

export const useStreamingText = (_initialText: string = "", speed: () => number = () => 20) => {
  const [text, setText] = createSignal("");
  let intervalId: any;
  let currentIndex = 0;

  function startStreaming(newText: string) {
    // Reset previous animation
    clearInterval(intervalId);
    setText("");
    currentIndex = 0;

    intervalId = setInterval(() => {
      if (currentIndex < newText.length) {
        setText((prev) => prev + newText[currentIndex]);
        currentIndex++;
      } else {
        clearInterval(intervalId);
      }
    }, speed());
  }

  onCleanup(() => {
    clearInterval(intervalId);
  });

  return [text, startStreaming] as const;
};

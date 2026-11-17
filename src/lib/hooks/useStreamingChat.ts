import { createSignal, onCleanup } from "solid-js";
import { getAuthToken } from "~/lib/api";
import type { StreamEvent, DomainType } from "~/lib/api/types";

export interface StreamingChatOptions {
  onProgress?: (_: any) => void;
  onComplete?: (_: any) => void;
  onError?: (_: string) => void;
  onRedirect?: (_domain: DomainType, _sessionId: string, _city: string) => void;
}

export interface StreamingChatState {
  isStreaming: boolean;
  isConnected: boolean;
  error: string | null;
  progress: number;
  currentStep: string;
  streamedData: any;
}

export function useStreamingChat(options: StreamingChatOptions = {}) {
  const [state, setState] = createSignal<StreamingChatState>({
    isStreaming: false,
    isConnected: false,
    error: null,
    progress: 0,
    currentStep: "",
    streamedData: null,
  });

  let reader: ReadableStreamDefaultReader<Uint8Array> | null = null;
  let abortController: AbortController | null = null;

  const startStream = async (url: string, requestBody: object) => {
    try {
      // Reset state
      setState({
        isStreaming: true,
        isConnected: false,
        error: null,
        progress: 0,
        currentStep: "Connecting...",
        streamedData: null,
      });

      abortController = new AbortController();
      const token = getAuthToken();

      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "text/event-stream",
          "Cache-Control": "no-cache",
          ...(token && { Authorization: `Bearer ${token}` }),
        },
        credentials: "include",
        body: JSON.stringify(requestBody),
        signal: abortController.signal,
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      if (!response.body) {
        throw new Error("Response body is null");
      }

      setState((prev) => ({
        ...prev,
        isConnected: true,
        currentStep: "Processing request...",
        progress: 10,
      }));

      reader = response.body.getReader();
      const decoder = new TextDecoder();

      await processStream(reader, decoder);
    } catch (err: any) {
      if (err.name === "AbortError") {
        console.log("Stream was aborted");
        return;
      }

      console.error("Streaming failed:", err);
      const errorMessage = err.message || "Failed to start streaming";

      setState((prev) => ({
        ...prev,
        error: errorMessage,
        isStreaming: false,
        isConnected: false,
      }));

      options.onError?.(errorMessage);
    }
  };

  const processStream = async (
    streamReader: ReadableStreamDefaultReader<Uint8Array>,
    decoder: TextDecoder,
  ) => {
    try {
      while (true) {
        const { done, value } = await streamReader.read();

        if (done) {
          setState((prev) => ({
            ...prev,
            isStreaming: false,
            isConnected: false,
            currentStep: "Complete!",
            progress: 100,
          }));
          break;
        }

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split("\n");

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const data = line.slice(6).trim();
            if (data === "") continue;

            try {
              const event: StreamEvent = JSON.parse(data);
              processStreamEvent(event);
            } catch (parseError) {
              console.error("Failed to parse SSE data:", parseError);
            }
          }
        }
      }
    } catch (error) {
      console.error("Stream processing error:", error);
      setState((prev) => ({
        ...prev,
        error: `Stream error: ${String(error)}`,
        isStreaming: false,
        isConnected: false,
      }));
      options.onError?.(`Stream error: ${String(error)}`);
    }
  };

  const processStreamEvent = (event: StreamEvent) => {
    switch (event.type) {
      case "start":
        setState((prev) => ({
          ...prev,
          currentStep: "Starting generation...",
          progress: 15,
        }));
        break;

      case "progress": {
        const progressData = event.data as any;
        if (progressData?.progress) {
          setState((prev) => ({
            ...prev,
            progress: progressData.progress,
            currentStep: progressData.message || prev.currentStep,
          }));
        }
        break;
      }

      case "city_data":
        setState((prev) => ({
          ...prev,
          currentStep: "Loading city information...",
          progress: 25,
        }));
        options.onProgress?.(event.data);
        break;

      case "general_pois":
        setState((prev) => ({
          ...prev,
          currentStep: "Finding points of interest...",
          progress: 50,
        }));
        options.onProgress?.(event.data);
        break;

      case "itinerary":
        setState((prev) => ({
          ...prev,
          currentStep: "Creating your itinerary...",
          progress: 75,
        }));
        options.onProgress?.(event.data);
        break;

      case "hotels":
        setState((prev) => ({
          ...prev,
          currentStep: "Finding accommodations...",
          progress: 60,
        }));
        options.onProgress?.(event.data);
        break;

      case "restaurants":
        setState((prev) => ({
          ...prev,
          currentStep: "Discovering restaurants...",
          progress: 65,
        }));
        options.onProgress?.(event.data);
        break;

      case "activities":
        setState((prev) => ({
          ...prev,
          currentStep: "Finding activities...",
          progress: 70,
        }));
        options.onProgress?.(event.data);
        break;

      case "complete": {
        const completeData = event.data as any;
        setState((prev) => ({
          ...prev,
          isStreaming: false,
          isConnected: false,
          currentStep: "Complete!",
          progress: 100,
          streamedData: completeData,
        }));

        // Handle redirect if navigation data is provided
        if (completeData?.domain && completeData?.session_id && completeData?.city) {
          options.onRedirect?.(completeData.domain, completeData.session_id, completeData.city);
        }

        options.onComplete?.(completeData);
        break;
      }

      case "error": {
        const errorMessage = (event.data as any)?.message || "An error occurred during streaming";
        setState((prev) => ({
          ...prev,
          error: errorMessage,
          isStreaming: false,
          isConnected: false,
        }));
        options.onError?.(errorMessage);
        break;
      }

      default:
        console.log("Unknown event type:", event.type, event);
    }
  };

  const stopStream = () => {
    if (abortController) {
      abortController.abort();
    }
    if (reader) {
      reader.cancel();
    }
    setState((prev) => ({
      ...prev,
      isStreaming: false,
      isConnected: false,
    }));
  };

  onCleanup(() => {
    stopStream();
  });

  return {
    state,
    startStream,
    stopStream,
  };
}

import { describe, it, expect, vi, beforeEach } from "vitest";
import { authAPI } from "./api";
// import { create } from '@bufbuild/protobuf';
// import { LoginRequestSchema, ValidateSessionRequestSchema } from '@buf/loci_loci-proto.bufbuild_es/proto/lociauth_pb.js';

const { mockLogin, mockValidateSession } = vi.hoisted(() => {
  return {
    mockLogin: vi.fn(),
    mockValidateSession: vi.fn(),
  };
});

// Mock @connectrpc/connect
vi.mock("@connectrpc/connect", () => ({
  createClient: () => ({
    login: mockLogin,
    validateSession: mockValidateSession,
  }),
}));

// Mock api dependencies
vi.mock("./connect-transport", () => ({
  transport: {},
}));

// Setup global mocks
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value.toString();
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
  };
})();

// Assign to globalThis for Node environment
Object.defineProperty(globalThis, "localStorage", { value: localStorageMock });
Object.defineProperty(globalThis, "sessionStorage", { value: localStorageMock });
Object.defineProperty(globalThis, "window", {
  value: {
    location: { href: "" },
    localStorage: localStorageMock,
    sessionStorage: localStorageMock,
  },
});

describe("Auth API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  describe("login", () => {
    it("should return token and message on successful login", async () => {
      const mockResponse = {
        accessToken: "fake-access-token",
        refreshToken: "fake-refresh-token",
        message: "Login successful",
      };
      mockLogin.mockResolvedValue(mockResponse);

      const result = await authAPI.login("test@example.com", "password123");

      expect(mockLogin).toHaveBeenCalled();
      expect(result).toEqual({
        mfa_required: false,
        mfa_token: "",
        access_token: "fake-access-token",
        refresh_token: "fake-refresh-token",
        message: "Login successful",
        user_id: "",
        username: "",
        email: "test@example.com",
      });
    });

    // A user with two-factor auth gets no tokens from login. Passing empty
    // strings on to setAuthToken would look like a signed-in session whose token
    // the server rejects on every call.
    it("reports an MFA challenge instead of tokens", async () => {
      mockLogin.mockResolvedValue({
        accessToken: "",
        refreshToken: "",
        message: "Enter your authentication code to finish signing in",
        email: "test@example.com",
        mfaRequired: true,
        mfaToken: "challenge-token",
      });

      const result = await authAPI.login("test@example.com", "password123");

      expect(result.mfa_required).toBe(true);
      expect(result.mfa_token).toBe("challenge-token");
      expect(result.access_token).toBe("");
    });

    it("should throw error on failed login", async () => {
      mockLogin.mockRejectedValue(new Error("Invalid credentials"));

      await expect(authAPI.login("test@example.com", "wrongpassword")).rejects.toThrow(
        "Invalid credentials",
      );
    });
  });

  describe("validateSession", () => {
    it("should return valid: false if no token exists", async () => {
      const result = await authAPI.validateSession();
      expect(result).toEqual({ valid: false });
      expect(mockValidateSession).not.toHaveBeenCalled();
    });

    it("should return valid session data on success", async () => {
      // Setup token with fake JWT payload structure (base64 encoded)
      // Payload: {"jti": "fake-session-uuid"} -> eyG...
      const fakePayload = JSON.stringify({ jti: "fake-session-uuid" });
      const fakeToken = `header.${btoa(fakePayload)}.signature`;

      localStorage.setItem("access_token", fakeToken);

      const mockResponse = {
        valid: true,
        userId: "user-123",
        username: "testuser",
        email: "test@example.com",
      };
      mockValidateSession.mockResolvedValue(mockResponse);

      const result = await authAPI.validateSession();

      expect(mockValidateSession).toHaveBeenCalled();
      // Verify we send the JTI as sessionId
      const callArgs = mockValidateSession.mock.calls[0][0];
      expect(callArgs.sessionId).toBe("fake-session-uuid");

      expect(result).toEqual({
        valid: true,
        user_id: "user-123",
        username: "testuser",
        email: "test@example.com",
      });
    });

    it("should handle unauthenticated error gracefully", async () => {
      localStorage.setItem("access_token", "expired-token");
      const error: any = new Error("Unauthenticated");
      error.code = "unauthenticated";
      mockValidateSession.mockRejectedValue(error);

      const result = await authAPI.validateSession();

      expect(result).toEqual({ valid: false });
    });
  });
});

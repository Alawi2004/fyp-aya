import { z } from "zod";

// E.164 phone format: starts with + followed by 8–15 digits (e.g. +96170123456)
const e164Regex = /^\+[1-9]\d{7,14}$/;

export const registerSchema = z.object({
  full_name: z
    .string()
    .trim()
    .min(1, "Name is required")
    .max(100, "Name must be 100 characters or fewer"),

  email: z
    .string()
    .trim()
    .email("Must be a valid email address")
    .toLowerCase()
    .max(120, "Email must be 120 characters or fewer"),

  password: z
    .string()
    .min(8,   "Password must be at least 8 characters")
    .max(128, "Password must be 128 characters or fewer")
    .regex(/[A-Z]/,        "Password must contain at least one uppercase letter")
    .regex(/[0-9]/,        "Password must contain at least one digit")
    .regex(/[^A-Za-z0-9]/, "Password must contain at least one special character"),

  phone: z
    .string()
    .trim()
    .regex(e164Regex, "Phone must be in E.164 format (e.g. +96170123456)")
    .optional()
    .or(z.literal(""))        // allow empty string — treated as absent
    .transform(v => v || undefined),

  birth_date: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "birth_date must be in YYYY-MM-DD format")
    .refine(v => new Date(v) <= new Date(), "Date of birth cannot be in the future")
    .optional()
    .or(z.literal(""))
    .transform(v => v || undefined),

  gender: z
    .enum(["male", "female"], { message: "gender must be 'male' or 'female'" })
    .optional()
    .or(z.literal(""))
    .transform(v => v || undefined),

  // Passengers self-register; staff/admin are created by admins only.
  // z.literal ensures any value other than "passenger" is rejected outright.
  role: z.literal("passenger").default("passenger"),
});

export const loginSchema = z.object({
  email: z.string().trim().email("Invalid email").toLowerCase(),
  password: z.string().min(1).max(128),
});

export const refreshSchema = z.object({
  refresh_token: z.string().min(1).optional(),
});

export const verify2faSchema = z.object({
  temp_token: z.string().min(1, "Temp token required"),
  totp_code: z.string().length(6, "TOTP code must be 6 digits").regex(/^\d+$/, "TOTP code must be numeric"),
});

export const confirm2faSchema = z.object({
  totp_code: z.string().length(6, "TOTP code must be 6 digits").regex(/^\d+$/, "TOTP code must be numeric"),
});

export const forgotPasswordSchema = z.object({
  email: z.string().trim().email("Invalid email").toLowerCase(),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1, "Reset token required"),
  password: z.string().min(8, "Password must be at least 8 characters").max(128),
});

export const disable2faSchema = z.object({
  totp_code: z.string().length(6, "TOTP code must be 6 digits").regex(/^\d+$/, "TOTP code must be numeric"),
});

export const sendOtpSchema = z.object({
  email:   z.string().trim().email("Invalid email").toLowerCase(),
  purpose: z.enum(["register", "login_verify", "reset_password"]).optional(),
});

export const resetPasswordOtpSchema = z.object({
  email:        z.string().trim().email("Invalid email").toLowerCase(),
  otp:          z.string().length(6, "Code must be 6 digits").regex(/^\d+$/, "Code must be numeric"),
  new_password: z.string().min(8, "Password must be at least 8 characters").max(128),
});

export const verifyOtpSchema = z.object({
  email: z.string().trim().email("Invalid email").toLowerCase(),
  code:  z.string().length(6, "Code must be 6 digits").regex(/^\d+$/, "Code must be numeric"),
});

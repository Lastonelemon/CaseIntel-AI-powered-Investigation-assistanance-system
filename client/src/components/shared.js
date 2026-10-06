import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
export { Fragment, useCallback, useEffect, useMemo, useRef, useState };
import { BrainCircuit, ClipboardList, FileText, GitFork, LayoutDashboard, MessageSquareText, Plus, Settings, Users } from "lucide-react";
export {
  Activity, AlertCircle, AlertTriangle, ArrowDown, ArrowDownRight, ArrowLeft, ArrowRight,
  ArrowUpRight, BadgeCheck, Bell, BrainCircuit, BriefcaseBusiness, CalendarDays, Check,
  CheckCircle2, ChevronDown, ChevronLeft, ChevronRight, CircleDot, ClipboardList, Clock3,
  Download, FileSpreadsheet, FileText, Filter, Fingerprint, GitFork, Globe2, LayoutDashboard,
  LoaderCircle, LogOut, Menu, MessageSquareText, Plus, Radio, RefreshCw, Search, Send,
  Settings, Shield, ShieldAlert, ShieldCheck, Sparkles, Sun, Moon, Target, Trash2, User, UserRound,
  Users, X, Zap,
} from "lucide-react";
export {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer,
  Tooltip, XAxis, YAxis,
} from "recharts";

export const API = "/api";
export async function api(path, options = {}) {
  const response = await fetch(`${API}${path}`, { credentials: "same-origin", ...options, headers: { ...(options.body && !(options.body instanceof FormData) ? { "Content-Type": "application/json" } : {}), ...options.headers } });
  const type = response.headers.get("content-type") || "";
  const body = type.includes("json") ? await response.json() : await response.text();
  if (!response.ok) throw new Error(body?.error || "The request could not be completed.");
  return body;
}
export const asJSON = (value) => JSON.stringify(value);
export const labelize = (value = "") => String(value).replace(/[_-]+/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
export const shortDate = (value) => { if (!value) return "—"; const date = new Date(value); return Number.isNaN(+date) ? String(value) : date.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }); };
export const urgencyClass = (value) => String(value || "unassessed").toLowerCase();
export const NAV = [
  { id: "Dashboard", icon: LayoutDashboard, section: "WORKSPACE" },
  { id: "Cases", icon: ClipboardList, section: "WORKSPACE" },
  { id: "AI Case Analysis", icon: BrainCircuit, section: "INTELLIGENCE", badge: "AI" },
  { id: "Case Correlation", icon: GitFork, section: "INTELLIGENCE" },
  { id: "Inspectors", icon: Users, section: "INTELLIGENCE" },
  { id: "Add Case", icon: Plus, section: "MANAGE" },
  { id: "Reports", icon: FileText, section: "MANAGE" },
  { id: "Settings", icon: Settings, section: "SYSTEM" },
];
export const COLORS = ["#54c7b2", "#6e8afa", "#f0b24c", "#c278ec", "#e47784", "#4ba8d1", "#8abb74", "#d3a56c"];
export const BASE_FIELDS = ["Complaint description", "Category", "Reported date", "Location", "External reference"];
export function mappedTo(column) { if (/id|number|reference/i.test(column)) return "Case reference"; if (/complaint|description|narrative|incident|details|summary/i.test(column)) return "Case summary"; if (/category|crime.?type|offen[cs]e/i.test(column)) return "Category"; if (/date|time|reported/i.test(column)) return "Reported date"; if (/location|city|district|state|address|region/i.test(column)) return "Location"; if (/status|resolution/i.test(column)) return "Status"; if (/urgency|priority|severity/i.test(column)) return "Urgency"; return "Preserved source field"; }

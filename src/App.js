import React, { useState, useEffect, useCallback, useMemo } from "react";
import { initializeApp } from "firebase/app";
import {
  getAuth,
  signInAnonymously,
  onAuthStateChanged,
  signInWithCustomToken,
} from "firebase/auth";
import {
  getFirestore,
  collection,
  addDoc,
  query,
  onSnapshot,
  doc,
  updateDoc,
  deleteDoc,
  setLogLevel,
  arrayUnion,
  writeBatch,
  getDocs,
  getDoc,
} from "firebase/firestore";
import {
  PlusCircle,
  Edit3,
  Trash2,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  Save,
  XCircle,
  FileDown,
  BarChart3,
  FileUp,
  Copy,
  Loader2, // Loader icon
} from "lucide-react";
import {
  format,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  startOfQuarter,
  endOfQuarter,
  startOfYear,
  endOfYear,
  addDays,
  subDays,
  parse,
  differenceInMinutes,
  getDay,
  isWithinInterval,
  addWeeks,
  subWeeks,
  eachDayOfInterval,
  eachWeekOfInterval,
  eachMonthOfInterval,
  getISOWeek,
  getQuarter,
  getYear,
  getMonth as getMonthIndex, // Alias to avoid conflict
} from "date-fns";
import { vi } from "date-fns/locale";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
} from "recharts";

// Default setting
var __firebase_config;
var __app_id = "working-schedule-app-v1"; // Incremented version
var __initial_auth_token; // No initial auth token

// Cấu hình Firebase
const firebaseConfig =
  typeof __firebase_config !== "undefined"
    ? JSON.parse(__firebase_config)
    : {
        apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
        authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
        projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID,
        storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
        messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
        appId: process.env.REACT_APP_FIREBASE_APP_ID,
      };

console.log("Firebase config:", firebaseConfig);
const app = initializeApp(firebaseConfig);
const dbGlobal = getFirestore(app);
const authGlobal = getAuth(app);
setLogLevel("debug");

const appId =
  typeof __app_id !== "undefined" ? __app_id : "working-schedule-app"; // Incremented version

const DAYS_OF_WEEK = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

// Helper function to convert HH:mm to minutes from midnight
const timeToMinutes = (timeStr) => {
  if (!timeStr || typeof timeStr !== "string" || !timeStr.includes(":")) {
    return 0;
  }
  const [hours, minutes] = timeStr.split(":").map(Number);
  if (isNaN(hours) || isNaN(minutes)) {
    return 0;
  }
  return hours * 60 + minutes;
};

// Helper function to convert minutes from midnight to HH:mm string
const minutesToTime = (totalMinutes) => {
  if (typeof totalMinutes !== "number" || isNaN(totalMinutes)) return "00:00";
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(
    2,
    "0"
  )}`;
};

const generateColorForClass = (className) => {
  if (!className) return "hsl(0, 0%, 80%)";

  let hash = 0;
  for (let i = 0; i < className.length; i++) {
    hash = className.charCodeAt(i) + ((hash << 5) - hash);
    hash = hash & hash;
  }
  const hue = Math.abs(hash) % 360;
  const saturation = 70;
  const lightness = 60;
  return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
};

function hslToRgb(h, s, l) {
  s /= 100;
  l /= 100;
  const k = (n) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n) =>
    l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  const r = 255 * f(0);
  const g = 255 * f(8);
  const b = 255 * f(4);
  return [r, g, b];
}

const getTextColorForBackground = (hslColor) => {
  if (!hslColor || !hslColor.startsWith("hsl(")) return "text-black";

  try {
    const parts = hslColor.match(/hsl\((\d+),\s*(\d+)%,\s*(\d+)%\)/);
    if (!parts) return "text-black";

    const h = parseInt(parts[1]);
    const s = parseInt(parts[2]);
    const l = parseInt(parts[3]);

    if (l > 75) return "text-black";
    if (l < 40) return "text-white";

    const [r, g, b] = hslToRgb(h, s, l);
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return luminance > 0.5 ? "text-black" : "text-white";
  } catch (error) {
    console.error("Error parsing HSL color for text contrast:", error);
    return "text-black";
  }
};

function ConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = "Confirm",
  cancelText = "Cancel",
  confirmColor = "bg-red-600 hover:bg-red-700",
  isSubmitting = false, // New prop for loading state
}) {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center p-4 z-[70]">
      <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-md">
        <h3 className="text-xl font-semibold text-gray-800 mb-4">{title}</h3>
        <p className="text-sm text-gray-600 mb-6 whitespace-pre-wrap">
          {message}
        </p>
        <div className="flex justify-end space-x-3">
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 disabled:opacity-50"
          >
            {cancelText}
          </button>
          <button
            onClick={onConfirm}
            disabled={isSubmitting}
            className={`px-4 py-2 text-sm font-medium text-white rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 ${confirmColor} focus:ring-${
              confirmColor.split("-")[1]
            }-500 disabled:opacity-50 flex items-center justify-center`}
          >
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}

function DeleteConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  slotInfo,
  currentWeekStart,
  isDeleting, // New prop for loading state
}) {
  const [deleteMode, setDeleteMode] = useState("all");
  const [rangeStart, setRangeStart] = useState("");
  const [rangeEnd, setRangeEnd] = useState("");
  const [modalError, setModalError] = useState("");

  useEffect(() => {
    if (isOpen) {
      setModalError("");
      if (slotInfo?.isRecurring) {
        setDeleteMode("current_instance");
        const instanceDate = format(
          addDays(currentWeekStart, slotInfo.dayOfWeek - 1),
          "yyyy-MM-dd"
        );
        setRangeStart(instanceDate);
        setRangeEnd(instanceDate);
      } else {
        setDeleteMode("all");
      }
    }
  }, [isOpen, slotInfo, currentWeekStart]);

  const handleConfirm = () => {
    setModalError("");
    if (slotInfo?.isRecurring && deleteMode === "date_range") {
      if (!rangeStart || !rangeEnd) {
        setModalError(
          "Please select a start and end date for the deletion range."
        );
        return;
      }
      if (
        parse(rangeStart, "yyyy-MM-dd", new Date()) >
        parse(rangeEnd, "yyyy-MM-dd", new Date())
      ) {
        setModalError("Start date cannot be after end date.");
        return;
      }
    }
    onConfirm(deleteMode, rangeStart, rangeEnd, currentWeekStart);
  };

  if (!isOpen || !slotInfo) return null;

  const title = "Confirm Delete Class";
  let message = `Are you sure you want to delete the class "${slotInfo.className}"?`;
  if (slotInfo.isRecurring) {
    message = `Select how to delete the recurring class "${slotInfo.className}":`;
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center p-4 z-[60]">
      <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-lg">
        <h3 className="text-xl font-semibold text-gray-800 mb-4">{title}</h3>
        <p className="text-sm text-gray-600 mb-4 whitespace-pre-wrap">
          {message}
        </p>

        {modalError && (
          <p className="text-red-600 bg-red-100 p-2 rounded-md text-sm mb-3">
            {modalError}
          </p>
        )}

        {slotInfo.isRecurring && (
          <div className="space-y-3 mb-4">
            <select
              value={deleteMode}
              onChange={(e) => setDeleteMode(e.target.value)}
              className="w-full p-2 border border-gray-300 rounded-md"
              disabled={isDeleting}
            >
              <option value="current_instance">
                Only this instance (on{" "}
                {format(
                  addDays(currentWeekStart, slotInfo.dayOfWeek - 1),
                  "dd/MM/yyyy"
                )}
                )
              </option>
              <option value="from_now_on">
                From this week ({format(currentWeekStart, "dd/MM/yyyy")})
                onwards
              </option>
              <option value="date_range">Within a date range...</option>
              <option value="all">Entire series of this class</option>
            </select>
            {deleteMode === "date_range" && (
              <div className="grid grid-cols-2 gap-3 mt-2">
                <div>
                  <label className="text-xs text-gray-600">Start Date:</label>
                  <input
                    type="date"
                    value={rangeStart}
                    onChange={(e) => setRangeStart(e.target.value)}
                    className="w-full p-2 border border-gray-300 rounded-md mt-1"
                    disabled={isDeleting}
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-600">End Date:</label>
                  <input
                    type="date"
                    value={rangeEnd}
                    onChange={(e) => setRangeEnd(e.target.value)}
                    className="w-full p-2 border border-gray-300 rounded-md mt-1"
                    disabled={isDeleting}
                  />
                </div>
              </div>
            )}
          </div>
        )}

        <div className="flex justify-end space-x-3">
          <button
            onClick={onClose}
            disabled={isDeleting}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={isDeleting}
            className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700 disabled:opacity-50 flex items-center justify-center"
          >
            {isDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Confirm Delete
          </button>
        </div>
      </div>
    </div>
  );
}

function SlotModal({
  isOpen,
  onClose,
  onSave,
  slot,
  currentWeekStart,
  isSavingSlot,
}) {
  // Added isSavingSlot prop
  const [className, setClassName] = useState("");
  const [startTime, setStartTime] = useState("08:00");
  const [endTime, setEndTime] = useState("09:30");
  const [location, setLocation] = useState("");
  const [salary, setSalary] = useState("");
  const [note, setNote] = useState("");
  const [isRecurringNature, setIsRecurringNature] = useState(true);
  const [dayOfWeek, setDayOfWeek] = useState(1);
  const [specificDate, setSpecificDate] = useState("");
  const [applyMode, setApplyMode] = useState("current_week_recurring");
  const [rangeStartDate, setRangeStartDate] = useState("");
  const [rangeEndDate, setRangeEndDate] = useState("");
  const [formError, setFormError] = useState("");

  useEffect(() => {
    setFormError("");
    if (slot) {
      setClassName(slot.className || "");
      setStartTime(slot.startTime || "08:00");
      setEndTime(slot.endTime || "09:30");
      setLocation(slot.location || "");
      setSalary(slot.salary ? String(slot.salary) : "");
      setNote(slot.note || "");
      setIsRecurringNature(
        slot.isRecurringNature !== undefined ? slot.isRecurringNature : true
      );
      setDayOfWeek(slot.dayOfWeek !== undefined ? slot.dayOfWeek : 1);
      setSpecificDate(
        slot.specificDate || format(currentWeekStart, "yyyy-MM-dd")
      );
      if (slot.id) {
        setApplyMode(
          slot.isRecurringNature ? "edit_recurring_all" : "edit_onetime"
        );
      } else {
        setApplyMode(slot.applyMode || "current_week_recurring");
      }
      setRangeStartDate(slot.effectiveStartDate || "");
      setRangeEndDate(slot.effectiveEndDate || "");
    } else {
      setClassName("");
      setStartTime("08:00");
      setEndTime("09:30");
      setLocation("");
      setSalary("");
      setNote("");
      setIsRecurringNature(true);
      setDayOfWeek(1);
      setSpecificDate(format(currentWeekStart, "yyyy-MM-dd"));
      setApplyMode("current_week_recurring");
      setRangeStartDate("");
      setRangeEndDate("");
    }
  }, [slot, isOpen, currentWeekStart]);

  useEffect(() => {
    if (!isRecurringNature && !slot?.id) {
      setSpecificDate(
        format(addDays(currentWeekStart, dayOfWeek - 1), "yyyy-MM-dd")
      );
    }
  }, [isRecurringNature, dayOfWeek, currentWeekStart, slot]);

  useEffect(() => {
    if (
      className &&
      startTime &&
      endTime &&
      timeToMinutes(startTime) < timeToMinutes(endTime) &&
      (!salary || (!isNaN(parseFloat(salary)) && parseFloat(salary) >= 0))
    ) {
      setFormError("");
    }
  }, [className, startTime, endTime, salary]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (isSavingSlot) return; // Prevent submission if already saving
    setFormError("");

    if (!className || !startTime || !endTime) {
      setFormError("Please enter Class Name, Start Time, and End Time.");
      return;
    }
    if (timeToMinutes(startTime) >= timeToMinutes(endTime)) {
      setFormError("End Time must be after Start Time.");
      return;
    }

    const salaryNumber = salary ? parseFloat(salary) : 0;
    if (salary && (isNaN(salaryNumber) || salaryNumber < 0)) {
      setFormError("Salary must be a non-negative number.");
      return;
    }

    let slotData = {
      className,
      startTime,
      endTime,
      location,
      salary: salaryNumber,
      note,
      isRecurringNature,
      color: generateColorForClass(className),
    };
    if (slot && slot.id) {
      slotData.excludedDates = slot.excludedDates || [];
    } else {
      slotData.excludedDates = [];
    }

    let finalApplyMode = applyMode;
    if (slot && slot.id) {
      finalApplyMode = slot.isRecurringNature
        ? "edit_recurring_all"
        : "edit_onetime";
    }

    if (!slot?.id) {
      if (isRecurringNature) {
        slotData.dayOfWeek = parseInt(dayOfWeek);
        if (finalApplyMode === "current_week_recurring") {
          slotData.effectiveStartDate = format(
            startOfWeek(currentWeekStart, { weekStartsOn: 1 }),
            "yyyy-MM-dd"
          );
          delete slotData.effectiveEndDate;
        } else if (finalApplyMode === "all_weeks_recurring") {
          delete slotData.effectiveStartDate;
          delete slotData.effectiveEndDate;
        } else if (finalApplyMode === "date_range") {
          if (!rangeStartDate || !rangeEndDate) {
            setFormError(
              "Please select a start and end date for the apply range."
            );
            return;
          }
          if (
            parse(rangeStartDate, "yyyy-MM-dd", new Date()) >
            parse(rangeEndDate, "yyyy-MM-dd", new Date())
          ) {
            setFormError(
              "Start date of the range cannot be after the end date."
            );
            return;
          }
          slotData.effectiveStartDate = rangeStartDate;
          slotData.effectiveEndDate = rangeEndDate;
        }
      } else {
        if (!specificDate) {
          setFormError("Please select a specific date for the one-time class.");
          return;
        }
        slotData.specificDate = specificDate;
      }
    }

    onSave(slotData, finalApplyMode, slot ? slot.id : null, currentWeekStart);
    // onClose(); // Close modal handled by parent after save completes
  };

  if (!isOpen) return null;
  const title = slot && slot.id ? "Edit Class" : "Add New Class";

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto custom-scrollbar">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-semibold text-gray-800">{title}</h2>
          <button
            onClick={onClose}
            disabled={isSavingSlot}
            className="text-gray-500 hover:text-gray-700 disabled:opacity-50"
          >
            <XCircle size={24} />
          </button>
        </div>
        {formError && (
          <p className="text-red-600 bg-red-100 p-3 rounded-md text-sm mb-4">
            {formError}
          </p>
        )}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Fields remain the same, but will be disabled if isSavingSlot is true */}
          <fieldset disabled={isSavingSlot} className="space-y-4">
            <div>
              <label
                htmlFor="className"
                className="block text-sm font-medium text-gray-700"
              >
                Class Name
              </label>
              <input
                type="text"
                id="className"
                value={className}
                onChange={(e) => setClassName(e.target.value)}
                required
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm disabled:bg-gray-100"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label
                  htmlFor="startTime"
                  className="block text-sm font-medium text-gray-700"
                >
                  Start Time
                </label>
                <input
                  type="time"
                  id="startTime"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  required
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm disabled:bg-gray-100"
                />
              </div>
              <div>
                <label
                  htmlFor="endTime"
                  className="block text-sm font-medium text-gray-700"
                >
                  End Time
                </label>
                <input
                  type="time"
                  id="endTime"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  required
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm disabled:bg-gray-100"
                />
              </div>
            </div>
            <div>
              <label
                htmlFor="location"
                className="block text-sm font-medium text-gray-700"
              >
                Location (if any)
              </label>
              <input
                type="text"
                id="location"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm disabled:bg-gray-100"
              />
            </div>
            <div>
              <label
                htmlFor="salary"
                className="block text-sm font-medium text-gray-700"
              >
                Salary (VNĐ)
              </label>
              <input
                type="number"
                id="salary"
                value={salary}
                onChange={(e) => setSalary(e.target.value)}
                min="0"
                placeholder="Leave blank if none"
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm disabled:bg-gray-100"
              />
            </div>
            <div>
              <label
                htmlFor="note"
                className="block text-sm font-medium text-gray-700"
              >
                Note
              </label>
              <textarea
                id="note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows="2"
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm disabled:bg-gray-100"
                placeholder="Add a note for the class..."
              ></textarea>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Class Type
              </label>
              <div className="mt-1 flex rounded-md shadow-sm">
                <button
                  type="button"
                  onClick={() => setIsRecurringNature(true)}
                  className={`px-4 py-2 rounded-l-md border border-gray-300 ${
                    isRecurringNature
                      ? "bg-indigo-600 text-white"
                      : "bg-white text-gray-700 hover:bg-gray-50"
                  } focus:outline-none w-1/2 disabled:bg-gray-100 disabled:text-gray-400`}
                >
                  Recurring
                </button>
                <button
                  type="button"
                  onClick={() => setIsRecurringNature(false)}
                  className={`px-4 py-2 rounded-r-md border border-gray-300 -ml-px ${
                    !isRecurringNature
                      ? "bg-indigo-600 text-white"
                      : "bg-white text-gray-700 hover:bg-gray-50"
                  } focus:outline-none w-1/2 disabled:bg-gray-100 disabled:text-gray-400`}
                >
                  One-time
                </button>
              </div>
            </div>
            {isRecurringNature ? (
              <div>
                <label
                  htmlFor="dayOfWeek"
                  className="block text-sm font-medium text-gray-700"
                >
                  Day of Week
                </label>
                <select
                  id="dayOfWeek"
                  value={dayOfWeek}
                  onChange={(e) => setDayOfWeek(parseInt(e.target.value))}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm disabled:bg-gray-100"
                >
                  {DAYS_OF_WEEK.map((day, index) => (
                    <option key={index} value={index + 1}>
                      {day}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <div>
                <label
                  htmlFor="specificDate"
                  className="block text-sm font-medium text-gray-700"
                >
                  Specific Date
                </label>
                <input
                  type="date"
                  id="specificDate"
                  value={specificDate}
                  onChange={(e) => setSpecificDate(e.target.value)}
                  required={!isRecurringNature}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm disabled:bg-gray-100"
                />
              </div>
            )}
            {(!slot || !slot.id) && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Apply Mode (when creating new)
                </label>
                <select
                  value={applyMode}
                  onChange={(e) => setApplyMode(e.target.value)}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm disabled:bg-gray-100"
                >
                  {isRecurringNature ? (
                    <>
                      <option value="current_week_recurring">
                        Recurring from this week (default)
                      </option>
                      <option value="all_weeks_recurring">
                        Recurring indefinitely (no end date)
                      </option>
                      <option value="date_range">
                        Recurring within a date range
                      </option>
                    </>
                  ) : (
                    <option value="current_week_onetime">
                      Only in this week (one-time)
                    </option>
                  )}
                </select>
                {isRecurringNature && applyMode === "date_range" && (
                  <div className="grid grid-cols-2 gap-4 mt-2">
                    <div>
                      <label
                        htmlFor="rangeStartDate"
                        className="block text-xs font-medium text-gray-700"
                      >
                        From Date
                      </label>
                      <input
                        type="date"
                        id="rangeStartDate"
                        value={rangeStartDate}
                        onChange={(e) => setRangeStartDate(e.target.value)}
                        className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm disabled:bg-gray-100"
                      />
                    </div>
                    <div>
                      <label
                        htmlFor="rangeEndDate"
                        className="block text-xs font-medium text-gray-700"
                      >
                        To Date
                      </label>
                      <input
                        type="date"
                        id="rangeEndDate"
                        value={rangeEndDate}
                        onChange={(e) => setRangeEndDate(e.target.value)}
                        className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm disabled:bg-gray-100"
                      />
                    </div>
                  </div>
                )}
              </div>
            )}
          </fieldset>
          <div className="flex justify-end space-x-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              disabled={isSavingSlot}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSavingSlot}
              className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 flex items-center justify-center"
            >
              {isSavingSlot && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              <Save size={18} className={isSavingSlot ? "" : "mr-2"} />{" "}
              {isSavingSlot ? "Saving..." : "Save"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ScheduleTable({
  slots,
  currentWeekStart,
  onEditSlot,
  onDeleteSlotPrompt,
  hoveredClass,
  setHoveredClass,
  onDuplicateSlot,
}) {
  const daysInView = useMemo(() => {
    return Array.from({ length: 7 }).map((_, i) =>
      addDays(currentWeekStart, i)
    );
  }, [currentWeekStart]);

  const activeSlotsForWeek = useMemo(() => {
    const weekStartBoundary = startOfWeek(currentWeekStart, {
      weekStartsOn: 1,
    });
    const weekEndBoundary = endOfWeek(currentWeekStart, { weekStartsOn: 1 });

    return slots.filter((slot) => {
      if (slot.isRecurringNature) {
        const seriesPotentiallyActive =
          (!slot.effectiveStartDate ||
            parse(slot.effectiveStartDate, "yyyy-MM-dd", new Date()) <=
              weekEndBoundary) &&
          (!slot.effectiveEndDate ||
            parse(slot.effectiveEndDate, "yyyy-MM-dd", new Date()) >=
              weekStartBoundary);
        return seriesPotentiallyActive;
      } else {
        const specificDate = parse(slot.specificDate, "yyyy-MM-dd", new Date());
        const isActive = isWithinInterval(specificDate, {
          start: weekStartBoundary,
          end: weekEndBoundary,
        });
        return isActive;
      }
    });
  }, [slots, currentWeekStart]);

  const minimalTimeIntervals = useMemo(() => {
    if (activeSlotsForWeek.length === 0) return [];

    const timePointsInMinutes = new Set();
    activeSlotsForWeek.forEach((slot) => {
      daysInView.forEach((dayDate) => {
        const formattedDay = format(dayDate, "yyyy-MM-dd");
        let isActiveOnThisDay = false;
        if (slot.isRecurringNature) {
          const dayMatches =
            getDay(dayDate) === (slot.dayOfWeek === 7 ? 0 : slot.dayOfWeek);
          const startDateOk =
            !slot.effectiveStartDate ||
            dayDate >= parse(slot.effectiveStartDate, "yyyy-MM-dd", new Date());
          const endDateOk =
            !slot.effectiveEndDate ||
            dayDate <= parse(slot.effectiveEndDate, "yyyy-MM-dd", new Date());
          const notExcluded = !slot.excludedDates?.includes(formattedDay);

          if (dayMatches && startDateOk && endDateOk && notExcluded) {
            isActiveOnThisDay = true;
          }
        } else {
          if (slot.specificDate === formattedDay) {
            isActiveOnThisDay = true;
          }
        }
        if (isActiveOnThisDay) {
          timePointsInMinutes.add(timeToMinutes(slot.startTime));
          timePointsInMinutes.add(timeToMinutes(slot.endTime));
        }
      });
    });

    if (timePointsInMinutes.size === 0) return [];

    const sortedTimePoints = Array.from(timePointsInMinutes).sort(
      (a, b) => a - b
    );

    const intervals = [];
    for (let i = 0; i < sortedTimePoints.length - 1; i++) {
      if (sortedTimePoints[i] < sortedTimePoints[i + 1]) {
        intervals.push({
          startMinutes: sortedTimePoints[i],
          endMinutes: sortedTimePoints[i + 1],
          start: minutesToTime(sortedTimePoints[i]),
          end: minutesToTime(sortedTimePoints[i + 1]),
        });
      }
    }
    return intervals;
  }, [activeSlotsForWeek, daysInView]);

  const tableRenderData = useMemo(() => {
    const data = [];
    if (minimalTimeIntervals.length === 0) return [];

    for (let i = 0; i < minimalTimeIntervals.length; i++) {
      data[i] = [];
      for (let j = 0; j < daysInView.length; j++) {
        data[i][j] = { slotsToRender: [], rowSpan: 1, display: true };
      }
    }

    daysInView.forEach((dayDate, dayIndex) => {
      activeSlotsForWeek.forEach((slot) => {
        const formattedDay = format(dayDate, "yyyy-MM-dd");
        let isActiveOnThisDay = false;
        if (slot.isRecurringNature) {
          const dayMatches =
            getDay(dayDate) === (slot.dayOfWeek === 7 ? 0 : slot.dayOfWeek);
          const startDateOk =
            !slot.effectiveStartDate ||
            dayDate >= parse(slot.effectiveStartDate, "yyyy-MM-dd", new Date());
          const endDateOk =
            !slot.effectiveEndDate ||
            dayDate <= parse(slot.effectiveEndDate, "yyyy-MM-dd", new Date());
          const notExcluded = !slot.excludedDates?.includes(formattedDay);
          if (dayMatches && startDateOk && endDateOk && notExcluded) {
            isActiveOnThisDay = true;
          }
        } else {
          if (slot.specificDate === formattedDay) {
            isActiveOnThisDay = true;
          }
        }

        if (isActiveOnThisDay) {
          const slotStartMinutes = timeToMinutes(slot.startTime);
          const slotEndMinutes = timeToMinutes(slot.endTime);

          let firstIntervalIndex = -1;
          let lastIntervalIndex = -1;

          for (let i = 0; i < minimalTimeIntervals.length; i++) {
            const interval = minimalTimeIntervals[i];
            if (
              Math.max(slotStartMinutes, interval.startMinutes) <
              Math.min(slotEndMinutes, interval.endMinutes)
            ) {
              if (firstIntervalIndex === -1) {
                firstIntervalIndex = i;
              }
              lastIntervalIndex = i;
            }
          }

          if (
            firstIntervalIndex !== -1 &&
            data[firstIntervalIndex]?.[dayIndex]?.display
          ) {
            data[firstIntervalIndex][dayIndex].slotsToRender.push(slot);
            const currentSlotRowSpan =
              lastIntervalIndex - firstIntervalIndex + 1;
            data[firstIntervalIndex][dayIndex].rowSpan = Math.max(
              data[firstIntervalIndex][dayIndex].rowSpan,
              currentSlotRowSpan
            );

            for (
              let k = 1;
              k < data[firstIntervalIndex][dayIndex].rowSpan;
              k++
            ) {
              if (
                firstIntervalIndex + k < minimalTimeIntervals.length &&
                data[firstIntervalIndex + k]?.[dayIndex]
              ) {
                data[firstIntervalIndex + k][dayIndex].display = false;
              }
            }
          }
        }
      });
      for (let i = 0; i < minimalTimeIntervals.length; i++) {
        if (data[i]?.[dayIndex]?.slotsToRender) {
          data[i][dayIndex].slotsToRender.sort(
            (a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime)
          );
        }
      }
    });
    return data;
  }, [minimalTimeIntervals, daysInView, activeSlotsForWeek]);

  if (minimalTimeIntervals.length === 0 && activeSlotsForWeek.length > 0) {
    return (
      <div className="p-4 text-center text-gray-500">
        No classes are scheduled or dynamic time slots could not be created.
      </div>
    );
  }
  if (activeSlotsForWeek.length === 0 && slots.length > 0) {
    return (
      <div className="p-4 text-center text-gray-500">
        No classes are scheduled for this week.
      </div>
    );
  }
  if (slots.length === 0) {
    return (
      <div className="p-4 text-center text-gray-500">
        No classes have been created yet. Add a new class!
      </div>
    );
  }

  return (
    <div className="overflow-x-auto bg-white shadow-md rounded-lg">
      <table className="min-w-full divide-y divide-gray-200 border-collapse">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-28 sticky left-0 bg-gray-50 z-10 border border-gray-300">
              Time
            </th>
            {daysInView.map((day) => (
              <th
                key={day.toISOString()}
                className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[120px] border border-gray-300"
              >
                {DAYS_OF_WEEK[getDay(day) === 0 ? 6 : getDay(day) - 1]} <br /> (
                {format(day, "dd/MM")})
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {minimalTimeIntervals.map((interval, intervalIndex) => (
            <tr key={`${interval.start}-${interval.end}`}>
              <td className="px-3 py-2 whitespace-nowrap text-xs font-medium text-gray-700 sticky left-0 bg-white z-10 border border-gray-300 align-top">
                {interval.start} - {interval.end}
              </td>
              {daysInView.map((dayDate, dayIndex) => {
                const cellData = tableRenderData[intervalIndex]?.[dayIndex];
                if (!cellData || !cellData.display) {
                  return null;
                }

                return (
                  <td
                    key={dayDate.toISOString()}
                    rowSpan={cellData.rowSpan}
                    className="px-1 py-1 align-top min-w-[140px] border border-gray-300"
                    style={{ height: `${cellData.rowSpan * 2.5}rem` }}
                  >
                    <div className="space-y-0.5 h-full overflow-y-auto custom-scrollbar">
                      {cellData.slotsToRender.map((slot) => {
                        const bgColor =
                          slot.color || generateColorForClass(slot.className);
                        const textColorClass =
                          getTextColorForBackground(bgColor);
                        return (
                          <div
                            key={slot.id}
                            style={{ backgroundColor: bgColor }}
                            className={`p-1 rounded shadow-sm text-[10px] leading-tight ${textColorClass} ${
                              hoveredClass === slot.className
                                ? "ring-2 ring-offset-1 ring-black"
                                : ""
                            } relative group cursor-pointer mb-0.5`}
                            onMouseEnter={() => setHoveredClass(slot.className)}
                            onMouseLeave={() => setHoveredClass(null)}
                          >
                            <p className="font-semibold truncate">
                              {slot.className}
                            </p>
                            <p className="truncate">
                              {slot.startTime} - {slot.endTime}
                            </p>
                            {slot.location && (
                              <p className="truncate text-[9px] mt-0.5">
                                {slot.location}
                              </p>
                            )}
                            <div className="absolute top-0.5 right-0.5 flex space-x-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button
                                onClick={() => onDuplicateSlot(slot)}
                                title="Duplicate"
                                className="p-0.5 bg-white/70 hover:bg-white rounded-full text-green-600"
                              >
                                <Copy size={10} />
                              </button>
                              <button
                                onClick={() => onEditSlot(slot)}
                                title="Edit"
                                className="p-0.5 bg-white/70 hover:bg-white rounded-full text-blue-600"
                              >
                                <Edit3 size={10} />
                              </button>
                              <button
                                onClick={() => onDeleteSlotPrompt(slot)}
                                title="Delete"
                                className="p-0.5 bg-white/70 hover:bg-white rounded-full text-red-600"
                              >
                                <Trash2 size={10} />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function RevenueStats({ slots, currentWeekStart }) {
  const [period, setPeriod] = useState("week");
  const [chartData, setChartData] = useState([]);
  const [totalRevenue, setTotalRevenue] = useState(0);
  const [referenceDateForStats, setReferenceDateForStats] =
    useState(currentWeekStart);

  // Update referenceDateForStats when currentWeekStart (viewed week) changes
  useEffect(() => {
    setReferenceDateForStats(currentWeekStart);
  }, [currentWeekStart]);

  const calculateRevenueData = useCallback(() => {
    // Use referenceDateForStats for month, quarter, year calculations
    const refDate = referenceDateForStats;
    let newChartData = [];
    let currentTotalRevenue = 0;
    let interval;
    let intervalStart, intervalEnd;

    const getRevenueForDate = (date) => {
      let dailyRevenue = 0;
      const formattedDate = format(date, "yyyy-MM-dd");
      slots.forEach((slot) => {
        if (slot.salary > 0 && !slot.excludedDates?.includes(formattedDate)) {
          if (slot.isRecurringNature) {
            const dayOfWeekJS = getDay(date);
            const slotDayOfWeekJS = slot.dayOfWeek === 7 ? 0 : slot.dayOfWeek;
            if (slotDayOfWeekJS === dayOfWeekJS) {
              let isActive = true;
              const instanceDate = date;
              if (
                slot.effectiveStartDate &&
                instanceDate <
                  parse(slot.effectiveStartDate, "yyyy-MM-dd", new Date())
              )
                isActive = false;
              if (
                slot.effectiveEndDate &&
                instanceDate >
                  parse(slot.effectiveEndDate, "yyyy-MM-dd", new Date())
              )
                isActive = false;
              if (isActive) dailyRevenue += slot.salary;
            }
          } else {
            if (slot.specificDate === formattedDate) {
              dailyRevenue += slot.salary;
            }
          }
        }
      });
      return dailyRevenue;
    };

    switch (period) {
      case "week":
        intervalStart = startOfWeek(referenceDateForStats, { weekStartsOn: 1 });
        intervalEnd = endOfWeek(referenceDateForStats, { weekStartsOn: 1 });
        interval = { start: intervalStart, end: intervalEnd };
        const daysInWeek = eachDayOfInterval(interval);
        newChartData = daysInWeek.map((day) => {
          const revenue = getRevenueForDate(day);
          currentTotalRevenue += revenue;
          return { name: format(day, "E dd/MM"), revenue };
        });
        break;
      case "month":
        intervalStart = startOfMonth(refDate);
        intervalEnd = endOfMonth(refDate);
        interval = { start: intervalStart, end: intervalEnd };
        const weeksInMonth = eachWeekOfInterval(interval, { weekStartsOn: 1 });
        newChartData = weeksInMonth.map((weekStart) => {
          const weekActualEnd = endOfWeek(weekStart, { weekStartsOn: 1 });
          let weeklyRevenue = 0;
          eachDayOfInterval({ start: weekStart, end: weekActualEnd }).forEach(
            (day) => {
              if (isWithinInterval(day, interval)) {
                // Only count days within the actual month
                weeklyRevenue += getRevenueForDate(day);
              }
            }
          );
          currentTotalRevenue += weeklyRevenue;
          // Modify the name to include the date range
          const weekStartDate = format(weekStart, "dd/MM", { locale: vi });
          const weekEndDate = format(weekActualEnd, "dd/MM", { locale: vi });
          const weekRangeName = `Tuần (${weekStartDate} - ${weekEndDate})`;
          return {
            name: weekRangeName,
            revenue: weeklyRevenue,
          };
        });
        break;
      case "quarter":
        intervalStart = startOfQuarter(refDate);
        intervalEnd = endOfQuarter(refDate);
        interval = { start: intervalStart, end: intervalEnd };
        const monthsInQuarter = eachMonthOfInterval(interval);
        newChartData = monthsInQuarter.map((monthStart) => {
          let monthlyRevenue = 0;
          eachDayOfInterval({
            start: monthStart,
            end: endOfMonth(monthStart),
          }).forEach((day) => {
            monthlyRevenue += getRevenueForDate(day);
          });
          currentTotalRevenue += monthlyRevenue;
          return {
            name: format(monthStart, "MMMM", { locale: vi }),
            revenue: monthlyRevenue,
          };
        });
        break;
      case "year":
        intervalStart = startOfYear(refDate);
        intervalEnd = endOfYear(refDate);
        interval = { start: intervalStart, end: intervalEnd };
        const monthsInYear = eachMonthOfInterval(interval);
        newChartData = monthsInYear.map((monthStart) => {
          let monthlyRevenue = 0;
          eachDayOfInterval({
            start: monthStart,
            end: endOfMonth(monthStart),
          }).forEach((day) => {
            monthlyRevenue += getRevenueForDate(day);
          });
          currentTotalRevenue += monthlyRevenue;
          return {
            name: format(monthStart, "MMM", { locale: vi }),
            revenue: monthlyRevenue,
          };
        });
        break;
      default:
        break;
    }
    setChartData(newChartData);
    setTotalRevenue(currentTotalRevenue);
  }, [slots, period, referenceDateForStats]);

  useEffect(() => {
    calculateRevenueData();
  }, [calculateRevenueData]);

  const chartBarColor = generateColorForClass("revenue_chart_bar");

  const getPeriodLabel = () => {
    const refDate = referenceDateForStats;
    switch (period) {
      case "week":
        return `Week (${format(
          startOfWeek(refDate, { weekStartsOn: 1 }),
          "dd/MM"
        )} - ${format(endOfWeek(refDate, { weekStartsOn: 1 }), "dd/MM")})`;
      case "month":
        return `Month ${format(refDate, "MM/yyyy", { locale: vi })}`;
      case "quarter":
        return `Quarter ${getQuarter(refDate)}/${getYear(refDate)}`;
      case "year":
        return `Year ${getYear(refDate)}`;
      default:
        return "";
    }
  };

  return (
    <div className="mt-6 p-4 bg-white shadow-md rounded-lg">
      <div className="flex justify-between items-center mb-3">
        <h3 className="text-xl font-semibold text-gray-800">
          Revenue Statistics
        </h3>
        <BarChart3 size={24} className="text-indigo-600" />
      </div>
      <div className="flex items-center space-x-2 mb-4">
        <label
          htmlFor="statsPeriod"
          className="text-sm font-medium text-gray-700"
        >
          View by:
        </label>
        <select
          id="statsPeriod"
          value={period}
          onChange={(e) => setPeriod(e.target.value)}
          className="px-3 py-1.5 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
        >
          <option value="week">
            Week (
            {format(
              startOfWeek(referenceDateForStats, { weekStartsOn: 1 }),
              "dd/MM"
            )}{" "}
            -{" "}
            {format(
              endOfWeek(referenceDateForStats, { weekStartsOn: 1 }),
              "dd/MM"
            )}
            )
          </option>
          <option value="month">
            Month ({format(referenceDateForStats, "MM/yyyy", { locale: vi })})
          </option>
          <option value="quarter">
            Quarter (Q{getQuarter(referenceDateForStats)}/
            {getYear(referenceDateForStats)})
          </option>
          <option value="year">Year ({getYear(referenceDateForStats)})</option>
        </select>
      </div>
      <p className="text-2xl font-bold text-indigo-600 mb-1">
        Total Revenue ({getPeriodLabel()}):
      </p>
      <p className="text-2xl font-bold text-indigo-600 mb-4">
        {new Intl.NumberFormat("vi-VN", {
          style: "currency",
          currency: "VND",
        }).format(totalRevenue)}
      </p>
      <div style={{ width: "100%", height: 300 }}>
        <ResponsiveContainer>
          <BarChart
            data={chartData}
            margin={{ top: 5, right: 20, left: 10, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis
              dataKey="name"
              angle={chartData.length > 7 ? -30 : 0}
              textAnchor={chartData.length > 7 ? "end" : "middle"}
              height={chartData.length > 7 ? 60 : 30}
              interval={0}
              tick={{ fontSize: 10 }}
            />
            <YAxis
              tickFormatter={(value) =>
                new Intl.NumberFormat("vi-VN").format(value)
              }
              tick={{ fontSize: 10 }}
            />
            <Tooltip
              formatter={(value) =>
                new Intl.NumberFormat("vi-VN", {
                  style: "currency",
                  currency: "VND",
                }).format(value)
              }
            />
            <Legend wrapperStyle={{ fontSize: "12px" }} />
            <Bar dataKey="revenue" name="Doanh thu">
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={chartBarColor} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// Main App Component
export default function App() {
  const [db, setDb] = useState(null);
  const [auth, setAuth] = useState(null);
  const [userId, setUserId] = useState(null);
  const [isAuthReady, setIsAuthReady] = useState(false);

  const [slots, setSlots] = useState([]);
  const [currentDate, setCurrentDate] = useState(new Date()); // This is the reference for the displayed week
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSlot, setEditingSlot] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [globalMessage, setGlobalMessage] = useState({ type: "", content: "" });

  const [isSavingSlot, setIsSavingSlot] = useState(false); // State for SlotModal loader
  const [isDeletingSlot, setIsDeletingSlot] = useState(false); // State for DeleteConfirmModal loader
  const [isImporting, setIsImporting] = useState(false); // State for ImportConfirmModal loader

  const [hoveredClass, setHoveredClass] = useState(null);
  const [showNotificationPermissionModal, setShowNotificationPermissionModal] =
    useState(false);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [slotToDeleteInfo, setSlotToDeleteInfo] = useState(null);

  const [isImportConfirmOpen, setIsImportConfirmOpen] = useState(false);
  const [parsedJsonDataForImport, setParsedJsonDataForImport] = useState(null);

  const displayGlobalMessage = (type, content) => {
    setGlobalMessage({ type, content });
    setTimeout(() => {
      setGlobalMessage({ type: "", content: "" });
    }, 5000);
  };

  useEffect(() => {
    setDb(dbGlobal);
    setAuth(authGlobal);

    const unsubscribe = onAuthStateChanged(authGlobal, async (user) => {
      if (user) {
        setUserId(user.uid);
        setIsAuthReady(true);
      } else {
        try {
          const token =
            typeof __initial_auth_token !== "undefined"
              ? __initial_auth_token
              : null;
          if (token) {
            await signInWithCustomToken(authGlobal, token);
          } else {
            await signInAnonymously(authGlobal);
          }
        } catch (err) {
          setError("Không thể xác thực người dùng: " + err.message);
          setIsAuthReady(true);
        }
      }
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!isAuthReady || !db || !userId) {
      if (isAuthReady && !userId && !error) setIsLoading(true);
      else if (error) setIsLoading(false);
      return;
    }

    setIsLoading(true);
    const slotsCollectionPath = `artifacts/${appId}/users/${userId}/teaching_slots`;
    const q = query(collection(db, slotsCollectionPath));

    const unsubscribe = onSnapshot(
      q,
      (querySnapshot) => {
        const fetchedSlots = [];
        querySnapshot.forEach((doc) => {
          fetchedSlots.push({ id: doc.id, ...doc.data() });
        });
        setSlots(fetchedSlots);
        setIsLoading(false);
      },
      (err) => {
        setError("Không thể tải dữ liệu lịch làm việc: " + err.message);
        setIsLoading(false);
      }
    );
    return () => unsubscribe();
  }, [isAuthReady, db, userId, error]);

  useEffect(() => {
    if (
      typeof Notification !== "undefined" &&
      Notification.permission === "default"
    ) {
      /* setShowNotificationPermissionModal(true); */
    }

    const checkUpcomingClasses = () => {
      if (
        typeof Notification === "undefined" ||
        Notification.permission !== "granted"
      )
        return;
      const now = new Date();
      slots.forEach((slot) => {
        let slotDateTime;
        const todayDateOnly = new Date(
          now.getFullYear(),
          now.getMonth(),
          now.getDate()
        );
        const formattedToday = format(todayDateOnly, "yyyy-MM-dd");
        if (slot.excludedDates?.includes(formattedToday)) return;

        if (slot.isRecurringNature) {
          const todayDayOfWeek = getDay(now) === 0 ? 7 : getDay(now);
          if (slot.dayOfWeek === todayDayOfWeek) {
            const [hours, minutes] = slot.startTime.split(":").map(Number);
            slotDateTime = new Date(
              now.getFullYear(),
              now.getMonth(),
              now.getDate(),
              hours,
              minutes
            );
            let activeForNotification = true;
            const instanceDate = todayDateOnly;
            if (
              slot.effectiveStartDate &&
              instanceDate <
                parse(slot.effectiveStartDate, "yyyy-MM-dd", new Date())
            )
              activeForNotification = false;
            if (
              slot.effectiveEndDate &&
              instanceDate >
                parse(slot.effectiveEndDate, "yyyy-MM-dd", new Date())
            )
              activeForNotification = false;
            if (!activeForNotification) slotDateTime = null;
          }
        } else {
          if (slot.specificDate === formattedToday) {
            const [hours, minutes] = slot.startTime.split(":").map(Number);
            slotDateTime = new Date(
              now.getFullYear(),
              now.getMonth(),
              now.getDate(),
              hours,
              minutes
            );
          }
        }

        if (slotDateTime) {
          const diffMins = differenceInMinutes(slotDateTime, now);
          if (diffMins > 0 && diffMins <= 30) {
            const notifiedKey = `notified_${slot.id}_${formattedToday}`;
            if (!localStorage.getItem(notifiedKey)) {
              try {
                new Notification(`Upcoming class: ${slot.className}`, {
                  body: `Class ${slot.className} starts at ${slot.startTime}${
                    slot.location ? ` at ${slot.location}` : ""
                  }.`,
                  tag: slot.id,
                });
                localStorage.setItem(notifiedKey, "true");
              } catch (e) {
                console.error("Error showing notification:", e);
              }
            }
          }
        }
      });
    };
    const intervalId = setInterval(checkUpcomingClasses, 60 * 1000);
    checkUpcomingClasses();
    return () => clearInterval(intervalId);
  }, [slots]);

  const handleRequestNotificationPermission = () => {
    if (typeof Notification === "undefined") {
      displayGlobalMessage(
        "error",
        "This browser does not support notifications."
      );
      setShowNotificationPermissionModal(false);
      return;
    }
    Notification.requestPermission().then((permission) => {
      if (permission === "granted") {
        try {
          new Notification("Notifications enabled!", {
            body: "You will receive notifications for upcoming classes.",
          });
        } catch (e) {
          console.error("Error showing permission granted notification:", e);
        }
      } else {
        displayGlobalMessage(
          "warn",
          "You have not granted notification permissions."
        );
      }
      setShowNotificationPermissionModal(false);
    });
  };

  const currentWeekStart = useMemo(
    () => startOfWeek(currentDate, { weekStartsOn: 1, locale: vi }),
    [currentDate]
  );

  const handlePrevWeek = () => setCurrentDate((prev) => subWeeks(prev, 1));
  const handleNextWeek = () => setCurrentDate((prev) => addWeeks(prev, 1));
  const handleToday = () => setCurrentDate(new Date());

  const handleOpenModal = (slotToEdit = null) => {
    setEditingSlot(slotToEdit);
    setIsModalOpen(true);
  };
  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingSlot(null);
  };

  const handleSaveSlot = async (
    slotDataFromModal,
    applyModeFromModal,
    slotId,
    modalOpenedWeekStart
  ) => {
    if (!db || !userId) {
      displayGlobalMessage("error", "Kết nối cơ sở dữ liệu không sẵn sàng.");
      return;
    }
    setIsSavingSlot(true); // Start loader
    const collectionPath = `artifacts/${appId}/users/${userId}/teaching_slots`;

    try {
      if (slotId) {
        const slotRef = doc(db, collectionPath, slotId);
        await updateDoc(slotRef, slotDataFromModal);
        displayGlobalMessage(
          "success",
          `Đã cập nhật tiết học "${slotDataFromModal.className}".`
        );
      } else {
        let finalSlotData = {
          ...slotDataFromModal,
          userId,
          createdAt: new Date().toISOString(),
        };
        if (!finalSlotData.excludedDates) {
          finalSlotData.excludedDates = [];
        }
        await addDoc(collection(db, collectionPath), finalSlotData);
        displayGlobalMessage(
          "success",
          `Đã thêm tiết học mới "${finalSlotData.className}".`
        );
      }
      handleCloseModal(); // Close modal on successful save
    } catch (err) {
      console.error("Error saving slot:", err);
      displayGlobalMessage("error", "Lỗi khi lưu tiết học: " + err.message);
    } finally {
      setIsSavingSlot(false); // Stop loader
    }
  };

  const handleDeleteSlotPrompt = (slotFullInfo) => {
    setSlotToDeleteInfo({
      id: slotFullInfo.id,
      isRecurring: slotFullInfo.isRecurringNature,
      className: slotFullInfo.className,
      dayOfWeek: slotFullInfo.dayOfWeek,
    });
    setIsDeleteConfirmOpen(true);
  };

  const executeDeleteSlot = async (
    deleteMode,
    rangeStartStr,
    rangeEndStr,
    modalCurrentWeekStartForDelete
  ) => {
    if (!db || !userId || !slotToDeleteInfo) {
      displayGlobalMessage("error", "Không thể xóa, thiếu thông tin.");
      setIsDeleteConfirmOpen(false);
      return;
    }
    setIsDeletingSlot(true); // Start loader
    const slotRef = doc(
      db,
      `artifacts/${appId}/users/${userId}/teaching_slots`,
      slotToDeleteInfo.id
    );
    try {
      if (!slotToDeleteInfo.isRecurring || deleteMode === "all") {
        await deleteDoc(slotRef);
        displayGlobalMessage(
          "success",
          `Đã xóa hoàn toàn tiết học "${slotToDeleteInfo.className}".`
        );
      } else {
        const slotDocSnap = await getDoc(slotRef);
        if (!slotDocSnap.exists())
          throw new Error("Không tìm thấy tiết học để cập nhật.");
        const slotData = slotDocSnap.data();

        if (deleteMode === "current_instance") {
          const instanceDateToDelete = format(
            addDays(modalCurrentWeekStartForDelete, slotData.dayOfWeek - 1),
            "yyyy-MM-dd"
          );
          await updateDoc(slotRef, {
            excludedDates: arrayUnion(instanceDateToDelete),
          });
          displayGlobalMessage(
            "success",
            `Đã xóa buổi học ngày ${format(
              parse(instanceDateToDelete, "yyyy-MM-dd", new Date()),
              "dd/MM/yyyy"
            )} của "${slotToDeleteInfo.className}".`
          );
        } else if (deleteMode === "from_now_on") {
          const dayBeforeThisReferencedWeekStart = format(
            subDays(
              startOfWeek(modalCurrentWeekStartForDelete, { weekStartsOn: 1 }),
              1
            ),
            "yyyy-MM-dd"
          );
          await updateDoc(slotRef, {
            effectiveEndDate: dayBeforeThisReferencedWeekStart,
          });
          displayGlobalMessage(
            "success",
            `Tiết học "${slotToDeleteInfo.className}" sẽ kết thúc trước tuần tham chiếu.`
          );
        } else if (deleteMode === "date_range") {
          const datesToExclude = [];
          let currentDatePointer = parse(
            rangeStartStr,
            "yyyy-MM-dd",
            new Date()
          );
          const endDateObject = parse(rangeEndStr, "yyyy-MM-dd", new Date());
          while (currentDatePointer <= endDateObject) {
            const dayOfWeekJS = getDay(currentDatePointer);
            const slotDayOfWeekJS =
              slotData.dayOfWeek === 7 ? 0 : slotData.dayOfWeek;
            if (slotDayOfWeekJS === dayOfWeekJS)
              datesToExclude.push(format(currentDatePointer, "yyyy-MM-dd"));
            currentDatePointer = addDays(currentDatePointer, 1);
          }
          if (datesToExclude.length > 0) {
            await updateDoc(slotRef, {
              excludedDates: arrayUnion(...datesToExclude),
            });
            displayGlobalMessage(
              "success",
              `Đã xóa ${datesToExclude.length} buổi học của "${slotToDeleteInfo.className}" trong khoảng đã chọn.`
            );
          } else {
            displayGlobalMessage(
              "info",
              `Không có buổi học nào của "${slotToDeleteInfo.className}" trong khoảng đã chọn để xóa.`
            );
          }
        }
      }
      setSlotToDeleteInfo(null);
    } catch (err) {
      displayGlobalMessage(
        "error",
        "Lỗi khi xử lý xóa tiết học: " + err.message
      );
    } finally {
      setIsDeletingSlot(false); // Stop loader
      setIsDeleteConfirmOpen(false);
    }
  };

  const exportToJson = () => {
    if (!slots || slots.length === 0) {
      displayGlobalMessage("warn", "Không có dữ liệu lịch làm việc để xuất.");
      return;
    }
    const exportableSlots = slots.map(({ id, userId, createdAt, ...rest }) => {
      const color = rest.color || generateColorForClass(rest.className);
      return { ...rest, color, note: rest.note || "" };
    });
    const jsonData = JSON.stringify(exportableSlots, null, 2);
    const blob = new Blob([jsonData], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `Backup_Config_${format(
      new Date(),
      "yyyyMMdd_HHmmss"
    )}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    displayGlobalMessage("success", "Dữ liệu đã được xuất thành công!");
  };

  const handleDuplicateSlot = (slotToDuplicate) => {
    const duplicatedSlot = { ...slotToDuplicate };
    delete duplicatedSlot.id;
    delete duplicatedSlot.createdAt;
    duplicatedSlot.excludedDates = [];
    duplicatedSlot.className = slotToDuplicate.className;
    duplicatedSlot.note = slotToDuplicate.note || "";
    duplicatedSlot.applyMode = duplicatedSlot.isRecurringNature
      ? "current_week_recurring"
      : "current_week_onetime";
    setEditingSlot(duplicatedSlot);
    setIsModalOpen(true);
  };

  const handleFileChangeAndInitiateImport = (event) => {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const jsonData = JSON.parse(e.target.result);
          if (Array.isArray(jsonData)) {
            setParsedJsonDataForImport(jsonData);
            setIsImportConfirmOpen(true);
          } else {
            displayGlobalMessage(
              "error",
              "File JSON không hợp lệ: phải là một mảng các tiết học."
            );
          }
        } catch (err) {
          displayGlobalMessage("error", "Lỗi đọc file JSON: " + err.message);
        }
      };
      reader.onerror = (err) => {
        displayGlobalMessage("error", "Không thể đọc file đã chọn.");
      };
      reader.readAsText(file);
    }
    event.target.value = null;
  };

  const executeImportSchedule = async () => {
    if (!db || !userId || !parsedJsonDataForImport) {
      displayGlobalMessage(
        "error",
        "Không thể nhập, thiếu thông tin hoặc dữ liệu."
      );
      setIsImportConfirmOpen(false);
      return;
    }
    setIsImporting(true); // Start loader
    const collectionPath = `artifacts/${appId}/users/${userId}/teaching_slots`;

    try {
      const currentSlotsSnapshot = await getDocs(
        query(collection(db, collectionPath))
      );
      const deleteBatch = writeBatch(db);
      currentSlotsSnapshot.forEach((doc) => deleteBatch.delete(doc.ref));
      await deleteBatch.commit();

      const addBatch = writeBatch(db);
      parsedJsonDataForImport.forEach((slotData) => {
        const newSlotRef = doc(collection(db, collectionPath));
        const slotWithDefaults = {
          ...slotData,
          userId,
          createdAt: new Date().toISOString(),
          excludedDates: slotData.excludedDates || [],
          note: slotData.note || "",
          color: slotData.color || generateColorForClass(slotData.className),
        };
        addBatch.set(newSlotRef, slotWithDefaults);
      });
      await addBatch.commit();
      displayGlobalMessage(
        "success",
        "Lịch làm việc đã được nhập thành công từ file JSON!"
      );
    } catch (err) {
      displayGlobalMessage(
        "error",
        "Lỗi khi nhập lịch làm việc: " + err.message
      );
    } finally {
      setIsImporting(false); // Stop loader
      setIsImportConfirmOpen(false);
      setParsedJsonDataForImport(null);
    }
  };

  // Render logic
  if (isLoading && !error && isAuthReady && !userId)
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-100 text-gray-700">
        Authenticating user...
      </div>
    );
  if (isLoading && !error)
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-100 text-gray-700">
        Loading schedule data...
      </div>
    );
  if (error)
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-red-100 text-red-700 p-4 text-center">
        <AlertTriangle size={48} className="mb-4 text-red-500" />
        <p className="text-xl font-semibold">An error occurred</p>
        <p className="mb-4">{error}</p>{" "}
        <button
          onClick={() => {
            setError(null);
            setIsLoading(true);
            if (!auth?.currentUser) {
              signInAnonymously(authGlobal).catch((e) => {
                setError("Relogin error: " + e.message);
                setIsLoading(false);
              });
            } else {
              setUserId(auth.currentUser.uid);
              setIsAuthReady(true);
            }
          }}
          className="mt-4 px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
        >
          Try again
        </button>
      </div>
    );
  if (!isAuthReady || !userId)
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-100 text-gray-700">
        Initializing application...
      </div>
    );

  return (
    <div className="p-4 md:p-6 bg-gray-100 min-h-screen font-sans">
      <style>{`
                .custom-scrollbar::-webkit-scrollbar { width: 6px; }
                .custom-scrollbar::-webkit-scrollbar-track { background: #f1f1f1; border-radius: 10px; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background: #888; border-radius: 10px; }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #555; }
                .recharts-default-legend { font-size: 12px !important; }
                .recharts-cartesian-axis-tick-value tspan { font-size: 10px; }
            `}</style>
      {globalMessage.content && (
        <div
          className={`fixed top-5 right-5 p-4 rounded-md shadow-lg text-white z-[100] ${
            globalMessage.type === "success"
              ? "bg-green-500"
              : globalMessage.type === "error"
              ? "bg-red-500"
              : "bg-yellow-500"
          }`}
        >
          {globalMessage.content}
          <button
            onClick={() => setGlobalMessage({ type: "", content: "" })}
            className="ml-4 text-lg font-semibold"
          >
            &times;
          </button>
        </div>
      )}
      <header className="mb-6">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl md:text-4xl font-bold text-indigo-700">
            {" "}
            Weekly Schedule{" "}
          </h1>
          {/* Logout button removed */}
        </div>
        {/* <p className="text-sm text-gray-600">UID: {userId}</p> */}
        {typeof Notification !== "undefined" &&
          Notification.permission === "default" &&
          !showNotificationPermissionModal && (
            <div className="mt-2 p-3 bg-yellow-100 border border-yellow-300 rounded-md text-yellow-700 text-sm">
              {" "}
              The application wants to send you class reminder notifications.{" "}
              <button
                onClick={() => setShowNotificationPermissionModal(true)}
                className="ml-2 font-semibold underline hover:text-yellow-800"
              >
                {" "}
                View details & Allow{" "}
              </button>
            </div>
          )}
      </header>

      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center space-x-2">
          <button
            onClick={handlePrevWeek}
            className="p-2 rounded-md bg-white hover:bg-gray-200 shadow text-indigo-600"
          >
            {" "}
            <ChevronLeft size={24} />{" "}
          </button>
          <button
            onClick={handleToday}
            className="px-4 py-2 rounded-md bg-white hover:bg-gray-200 shadow text-indigo-600 text-sm font-medium"
          >
            {" "}
            Today{" "}
          </button>
          <button
            onClick={handleNextWeek}
            className="p-2 rounded-md bg-white hover:bg-gray-200 shadow text-indigo-600"
          >
            {" "}
            <ChevronRight size={24} />{" "}
          </button>
          <h2 className="text-xl font-semibold text-gray-700 ml-2 hidden md:block">
            {" "}
            Week from{" "}
            {format(currentWeekStart, "dd/MM/yyyy", {
              locale: vi,
            })}{" "}
            -{" "}
            {format(addDays(currentWeekStart, 6), "dd/MM/yyyy", { locale: vi })}{" "}
          </h2>
        </div>
        <div className="flex items-center space-x-2">
          <div className="relative">
            {" "}
            <input
              type="file"
              accept=".json"
              onChange={handleFileChangeAndInitiateImport}
              id="upload-json-input"
              className="hidden"
            />{" "}
            <button
              onClick={() =>
                document.getElementById("upload-json-input").click()
              }
              className="flex items-center px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-md shadow-md transition duration-150 text-sm"
            >
              {" "}
              <FileUp size={18} className="mr-2" /> Import Config{" "}
            </button>{" "}
          </div>
          <div className="relative">
            {" "}
            <button
              onClick={exportToJson}
              className="flex items-center px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-md shadow-md transition duration-150 text-sm"
            >
              {" "}
              <FileDown size={18} className="mr-2" /> Export Config{" "}
            </button>{" "}
          </div>
          <button
            onClick={() => handleOpenModal()}
            className="flex items-center px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-md shadow-md transition duration-150 text-sm"
          >
            {" "}
            <PlusCircle size={18} className="mr-2" /> Add Class{" "}
          </button>
        </div>
      </div>
      <h2 className="text-xl font-semibold text-gray-700 mb-4 md:hidden text-center">
        {" "}
        Week: {format(currentWeekStart, "dd/MM")} -{" "}
        {format(addDays(currentWeekStart, 6), "dd/MM")}{" "}
      </h2>

      <ScheduleTable
        slots={slots}
        currentWeekStart={currentWeekStart}
        onEditSlot={handleOpenModal}
        onDeleteSlotPrompt={handleDeleteSlotPrompt}
        hoveredClass={hoveredClass}
        setHoveredClass={setHoveredClass}
        onDuplicateSlot={handleDuplicateSlot}
      />
      <RevenueStats slots={slots} currentWeekStart={currentWeekStart} />
      <SlotModal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        onSave={handleSaveSlot}
        slot={editingSlot}
        currentWeekStart={currentWeekStart}
        isSavingSlot={isSavingSlot}
      />
      <DeleteConfirmModal
        isOpen={isDeleteConfirmOpen}
        onClose={() => setIsDeleteConfirmOpen(false)}
        onConfirm={executeDeleteSlot}
        slotInfo={slotToDeleteInfo}
        currentWeekStart={currentWeekStart}
        isDeleting={isDeletingSlot}
      />
      <ConfirmModal
        isOpen={isImportConfirmOpen}
        onClose={() => {
          setIsImportConfirmOpen(false);
          setParsedJsonDataForImport(null);
        }}
        onConfirm={executeImportSchedule}
        title="Confirm Import Schedule"
        message="Are you sure you want to import schedule from this JSON file? All current schedule data will be deleted and replaced."
        confirmText="Import"
        confirmColor="bg-blue-600 hover:bg-blue-700"
        isSubmitting={isImporting}
      />
      {showNotificationPermissionModal && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center p-4 z-[70]">
          <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-md">
            <h3 className="text-lg font-semibold text-gray-800 mb-2">
              Allow Notifications?
            </h3>
            <p className="text-sm text-gray-600 mb-4">
              The application wants to send you notifications to remind you of
              upcoming classes. You can change this setting in your browser at
              any time.
            </p>
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => {
                  setShowNotificationPermissionModal(false);
                }}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
              >
                Later
              </button>
              <button
                onClick={handleRequestNotificationPermission}
                className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700"
              >
                Allow
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

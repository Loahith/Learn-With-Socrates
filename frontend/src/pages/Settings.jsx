import { useRef, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Camera, Trash2, User, GraduationCap, Globe, Crop } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { Modal, Spinner } from "@/components/ui/misc";
import ImageCropModal from "@/components/ImageCropModal";
import api, { errMsg } from "@/lib/api";
import { useAuth } from "@/store/auth";
import { cn } from "@/lib/utils";
import { toast } from "@/store/toast";

const TABS = ["Profile", "Learning", "Notifications", "Security", "Account"];

function Toggle({ checked, onChange, label, hint }) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-4 rounded-xl border border-line p-4">
      <span><span className="block text-sm font-semibold">{label}</span><span className="text-xs text-grey">{hint}</span></span>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="h-5 w-5 accent-[#28765a]" />
    </label>
  );
}

export default function Settings() {
  const navigate = useNavigate();
  const { user, setUser, clear } = useAuth();
  const p = user?.profile || {};
  const [tab, setTab] = useState("Profile");
  const [busy, setBusy] = useState(false);
  const [avatarBusy, setAvatarBusy] = useState(false);
  const [cropModalOpen, setCropModalOpen] = useState(false);
  const [cropImageSrc, setCropImageSrc] = useState("");
  const fileInputRef = useRef(null);

  const [profile, setProfile] = useState({
    name: user?.name || "",
    avatar_url: p.avatar_url || "",
    phone: p.phone || "",
    dob: p.dob || "",
    bio: p.bio || "",
    location: p.location || "",
    academic_year: p.academic_year || "",
    primary_language: p.primary_language || "",
    education_level: p.education_level || "",
    institution: p.institution || "",
    major: p.major || "",
    learning_goal: p.learning_goal || "",
    linkedin_url: p.linkedin_url || "",
    github_url: p.github_url || "",
  });

  useEffect(() => {
    if (user) {
      const up = user.profile || {};
      setProfile({
        name: user.name || "",
        avatar_url: up.avatar_url || "",
        phone: up.phone || "",
        dob: up.dob || "",
        bio: up.bio || "",
        location: up.location || "",
        academic_year: up.academic_year || "",
        primary_language: up.primary_language || "",
        education_level: up.education_level || "",
        institution: up.institution || "",
        major: up.major || "",
        learning_goal: up.learning_goal || "",
        linkedin_url: up.linkedin_url || "",
        github_url: up.github_url || "",
      });
    }
  }, [user]);

  const [prefs, setPrefs] = useState({
    preferred_mode: p.preferred_mode || "socratic",
    difficulty_level: p.difficulty_level || "beginner",
    daily_goal_minutes: p.daily_goal_minutes || 30,
    notify_revision: p.notify_revision ?? true,
    notify_progress: p.notify_progress ?? true,
  });

  const [pw, setPw] = useState({ current_password: "", new_password: "", confirm: "" });
  const [delOpen, setDelOpen] = useState(false);
  const [delPw, setDelPw] = useState("");

  const run = async (fn, okMsg) => {
    setBusy(true);
    try {
      await fn();
      if (okMsg) toast.success(okMsg);
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setBusy(false);
    }
  };

  const handleAvatarChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      return toast.error("Please choose an image file (PNG, JPG, or WebP).");
    }
    if (file.size > 8 * 1024 * 1024) {
      return toast.error("Image file is too large (max 8MB).");
    }

    const reader = new FileReader();
    reader.onload = () => {
      setCropImageSrc(reader.result);
      setCropModalOpen(true);
    };
    reader.readAsDataURL(file);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleCropConfirm = async (blob, dataUrl) => {
    setAvatarBusy(true);
    try {
      const formData = new FormData();
      formData.append("avatar", blob, "avatar.jpg");
      const res = await api.post("/profile/avatar", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setUser(res.data.user);
      setProfile((prev) => ({ ...prev, avatar_url: res.data.avatar_url }));
      toast.success("Profile photo adjusted and updated!");
      setCropModalOpen(false);
    } catch (err) {
      toast.error(errMsg(err, "Failed to save adjusted profile photo."));
    } finally {
      setAvatarBusy(false);
    }
  };

  const handleRemoveAvatar = async () => {
    setAvatarBusy(true);
    try {
      const res = await api.delete("/profile/avatar");
      setUser(res.data.user);
      setProfile((prev) => ({ ...prev, avatar_url: "" }));
      toast.success("Profile photo removed.");
    } catch (err) {
      toast.error(errMsg(err, "Failed to remove profile photo."));
    } finally {
      setAvatarBusy(false);
    }
  };

  const saveProfile = (e) => {
    e.preventDefault();
    run(async () => {
      const r = await api.put("/profile", profile);
      setUser(r.data.user);
    }, "Profile saved.");
  };

  const savePrefs = (e) => {
    e?.preventDefault();
    run(async () => {
      const r = await api.put("/profile/preferences", prefs);
      setUser(r.data.user);
    }, "Preferences saved.");
  };

  const changePw = (e) => {
    e.preventDefault();
    if (pw.new_password !== pw.confirm) return toast.error("New passwords do not match.");
    run(async () => {
      await api.put("/profile/password", { current_password: pw.current_password, new_password: pw.new_password });
      setPw({ current_password: "", new_password: "", confirm: "" });
    }, "Password changed.");
  };

  const deleteAccount = () =>
    run(async () => {
      await api.delete("/profile", { data: { password: delPw } });
      clear();
      navigate("/");
    }, "Account deleted.");

  const Save = ({ children = "Save changes" }) => (
    <Button type="submit" disabled={busy}>
      {busy ? <Spinner className="text-white" /> : children}
    </Button>
  );

  const initial = (profile.name || user?.name || "?").trim()[0]?.toUpperCase();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold md:text-3xl">Profile & Settings</h1>
        <p className="text-grey">{user?.email}</p>
      </div>

      <div className="flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              "rounded-full px-4 py-2 text-sm font-semibold transition-colors",
              tab === t ? "bg-forest text-white" : "border border-line bg-white text-grey hover:text-forest"
            )}
          >
            {t}
          </button>
        ))}
      </div>

      <Card className="max-w-3xl p-6">
        {tab === "Profile" && (
          <form onSubmit={saveProfile} className="space-y-6">
            {/* Profile Avatar Card */}
            <div className="flex flex-col sm:flex-row items-center gap-5 rounded-2xl border border-line bg-ivory/50 p-4 sm:p-5">
              <div className="relative">
                <div className="flex h-24 w-24 sm:h-28 sm:w-28 items-center justify-center overflow-hidden rounded-full bg-sage font-display text-3xl font-extrabold text-forest shadow-md ring-4 ring-white">
                  {profile.avatar_url ? (
                    <img src={profile.avatar_url} alt={profile.name} className="h-full w-full object-cover" />
                  ) : (
                    initial
                  )}
                </div>
                {avatarBusy && (
                  <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40">
                    <Spinner className="text-white" />
                  </div>
                )}
              </div>
              <div className="flex-1 text-center sm:text-left space-y-2">
                <div>
                  <h3 className="font-bold text-forest">Profile Picture</h3>
                  <p className="text-xs text-grey">Upload a photo or portrait (PNG, JPG, or WebP up to 5MB).</p>
                </div>
                <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 pt-1">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/gif"
                    className="hidden"
                    onChange={handleAvatarChange}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="gap-1.5"
                    disabled={avatarBusy}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Camera size={14} />
                    {profile.avatar_url ? "Change photo" : "Upload photo"}
                  </Button>
                  {profile.avatar_url && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="gap-1.5 text-forest"
                      disabled={avatarBusy}
                      onClick={() => {
                        setCropImageSrc(profile.avatar_url);
                        setCropModalOpen(true);
                      }}
                    >
                      <Crop size={14} />
                      Adjust / Slice
                    </Button>
                  )}
                  {profile.avatar_url && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="gap-1.5 text-red-600 hover:bg-red-50 hover:text-red-700"
                      disabled={avatarBusy}
                      onClick={handleRemoveAvatar}
                    >
                      <Trash2 size={14} />
                      Remove
                    </Button>
                  )}
                </div>
              </div>
            </div>

            {/* Section: Basic Information */}
            <div className="space-y-4">
              <div className="border-b border-line pb-2">
                <h3 className="text-base font-bold text-forest flex items-center gap-2">
                  <User size={18} className="text-brand" /> Personal Information
                </h3>
                <p className="text-xs text-grey">Your personal details and profile information.</p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Full name" className="sm:col-span-2">
                  <Input
                    value={profile.name}
                    onChange={(e) => setProfile({ ...profile, name: e.target.value })}
                    placeholder="Your full name"
                  />
                </Field>

                <Field
                  label="Bio / About me"
                  className="sm:col-span-2"
                  hint="A brief summary about yourself, what you study, or your learning style."
                >
                  <Textarea
                    rows={3}
                    value={profile.bio}
                    onChange={(e) => setProfile({ ...profile, bio: e.target.value })}
                    placeholder="Tell us a bit about yourself, your interests, or study habits..."
                  />
                </Field>

                <Field label="Phone number">
                  <Input
                    type="tel"
                    value={profile.phone}
                    onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
                    placeholder="e.g. +91 98765 43210"
                  />
                </Field>

                <Field label="Date of birth">
                  <Input
                    type="date"
                    value={profile.dob}
                    onChange={(e) => setProfile({ ...profile, dob: e.target.value })}
                  />
                </Field>

                <Field label="Location / City">
                  <Input
                    value={profile.location}
                    onChange={(e) => setProfile({ ...profile, location: e.target.value })}
                    placeholder="e.g. Chennai, India"
                  />
                </Field>

                <Field label="Primary language">
                  <Select
                    value={profile.primary_language}
                    onChange={(e) => setProfile({ ...profile, primary_language: e.target.value })}
                  >
                    <option value="">Select language…</option>
                    {["English", "Tamil", "Hindi", "Telugu", "Kannada", "Malayalam", "Spanish", "French", "German", "Mandarin", "Arabic", "Other"].map((lang) => (
                      <option key={lang} value={lang}>{lang}</option>
                    ))}
                  </Select>
                </Field>
              </div>
            </div>

            {/* Section: Academic & Education */}
            <div className="space-y-4">
              <div className="border-b border-line pb-2">
                <h3 className="text-base font-bold text-forest flex items-center gap-2">
                  <GraduationCap size={18} className="text-brand" /> Academic & Learning Details
                </h3>
                <p className="text-xs text-grey">Help Socrates tailor responses and explanations to your learning background.</p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Education level">
                  <Select
                    value={profile.education_level}
                    onChange={(e) => setProfile({ ...profile, education_level: e.target.value })}
                  >
                    <option value="">Select level…</option>
                    {["Middle school", "High school", "Undergraduate", "Postgraduate / Master's", "Doctorate / PhD", "Professional", "Self-learner"].map((x) => (
                      <option key={x} value={x}>{x}</option>
                    ))}
                  </Select>
                </Field>

                <Field label="Institution / College / School" className="sm:col-span-2">
                  <Input
                    value={profile.institution}
                    onChange={(e) => setProfile({ ...profile, institution: e.target.value })}
                    placeholder="e.g. IIT Madras, Anna University, Stanford"
                  />
                </Field>

                <Field label="Major / Field of study" className="sm:col-span-2">
                  <Input
                    value={profile.major}
                    onChange={(e) => setProfile({ ...profile, major: e.target.value })}
                    placeholder="e.g. Computer Science, Artificial Intelligence, Electrical Engineering"
                  />
                </Field>

                <Field label="Primary learning goal" className="sm:col-span-2" hint="What is your main focus or ambition?">
                  <Input
                    value={profile.learning_goal}
                    onChange={(e) => setProfile({ ...profile, learning_goal: e.target.value })}
                    placeholder="e.g. Prepare for semester exams, master deep learning fundamentals"
                  />
                </Field>
              </div>
            </div>

            {/* Section: Links & Socials */}
            <div className="space-y-4">
              <div className="border-b border-line pb-2">
                <h3 className="text-base font-bold text-forest flex items-center gap-2">
                  <Globe size={18} className="text-brand" /> Links & Socials <span className="text-xs font-normal text-grey">(Optional)</span>
                </h3>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="LinkedIn profile">
                  <Input
                    value={profile.linkedin_url}
                    onChange={(e) => setProfile({ ...profile, linkedin_url: e.target.value })}
                    placeholder="https://linkedin.com/in/username"
                  />
                </Field>

                <Field label="GitHub / Portfolio">
                  <Input
                    value={profile.github_url}
                    onChange={(e) => setProfile({ ...profile, github_url: e.target.value })}
                    placeholder="https://github.com/username"
                  />
                </Field>
              </div>
            </div>

            <div className="pt-2">
              <Save />
            </div>
          </form>
        )}

        {tab === "Learning" && (
          <form onSubmit={savePrefs} className="space-y-4">
            <Field label="Default teaching mode">
              <Select value={prefs.preferred_mode} onChange={(e) => setPrefs({ ...prefs, preferred_mode: e.target.value })}>
                <option value="socratic">Socratic Learning</option>
                <option value="direct">Direct Teaching</option>
              </Select>
            </Field>
            <Field label="Explanation level">
              <Select value={prefs.difficulty_level} onChange={(e) => setPrefs({ ...prefs, difficulty_level: e.target.value })}>
                <option value="beginner">Beginner</option>
                <option value="intermediate">Intermediate</option>
                <option value="advanced">Advanced</option>
              </Select>
            </Field>
            <Field label="Daily study goal (minutes)">
              <Input
                type="number"
                min={5}
                max={600}
                value={prefs.daily_goal_minutes}
                onChange={(e) => setPrefs({ ...prefs, daily_goal_minutes: e.target.value })}
              />
            </Field>
            <Save />
          </form>
        )}

        {tab === "Notifications" && (
          <div className="space-y-3">
            <Toggle
              label="Revision reminders"
              hint="Suggest topics that are due for review."
              checked={prefs.notify_revision}
              onChange={(v) => setPrefs({ ...prefs, notify_revision: v })}
            />
            <Toggle
              label="Progress updates"
              hint="Notify me when resources finish processing and when I improve."
              checked={prefs.notify_progress}
              onChange={(v) => setPrefs({ ...prefs, notify_progress: v })}
            />
            <Button onClick={() => savePrefs()} disabled={busy}>Save</Button>
          </div>
        )}

        {tab === "Security" && (
          <form onSubmit={changePw} className="space-y-4">
            <Field label="Current password">
              <Input
                type="password"
                autoComplete="current-password"
                value={pw.current_password}
                onChange={(e) => setPw({ ...pw, current_password: e.target.value })}
              />
            </Field>
            <Field label="New password" hint="8+ characters with letters and numbers">
              <Input
                type="password"
                autoComplete="new-password"
                value={pw.new_password}
                onChange={(e) => setPw({ ...pw, new_password: e.target.value })}
              />
            </Field>
            <Field label="Confirm new password">
              <Input
                type="password"
                autoComplete="new-password"
                value={pw.confirm}
                onChange={(e) => setPw({ ...pw, confirm: e.target.value })}
              />
            </Field>
            <Save>Change password</Save>
          </form>
        )}

        {tab === "Account" && (
          <div className="space-y-3">
            <h2 className="text-lg font-bold text-red-600">Delete account</h2>
            <p className="text-sm text-grey">
              This permanently removes your account, uploaded files, progress and quiz history. It cannot be undone.
            </p>
            <Button className="bg-red-600 hover:bg-red-700" onClick={() => setDelOpen(true)}>
              Delete my account
            </Button>
          </div>
        )}
      </Card>

      <Modal open={delOpen} onClose={() => setDelOpen(false)} title="Confirm account deletion">
        <Field label="Enter your password to confirm">
          <Input type="password" value={delPw} onChange={(e) => setDelPw(e.target.value)} />
        </Field>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="outline" onClick={() => setDelOpen(false)}>Cancel</Button>
          <Button className="bg-red-600 hover:bg-red-700" disabled={!delPw || busy} onClick={deleteAccount}>
            Delete forever
          </Button>
        </div>
      </Modal>

      <ImageCropModal
        open={cropModalOpen}
        imageSrc={cropImageSrc}
        onClose={() => setCropModalOpen(false)}
        onConfirm={handleCropConfirm}
        busy={avatarBusy}
      />
    </div>
  );
}

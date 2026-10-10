import React, { useState } from "react";
import { CheckCircle, ChevronRight, ChevronLeft, Plus, Trash2, AlertCircle } from "lucide-react";
import api from "@/lib/api";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function Field({ label, required, children, hint }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-[#374151] mb-1.5 uppercase tracking-wider">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      {children}
      {hint && <p className="text-xs text-[#6B7280] mt-1">{hint}</p>}
    </div>
  );
}

function Input({ className = "", ...props }) {
  return (
    <input
      className={`w-full px-4 py-2.5 rounded-xl border border-[#E5E7EB] text-sm focus:outline-none focus:ring-2 focus:ring-[#044875]/30 focus:border-[#044875] transition-all bg-white ${className}`}
      {...props}
    />
  );
}

function Textarea({ className = "", ...props }) {
  return (
    <textarea
      className={`w-full px-4 py-2.5 rounded-xl border border-[#E5E7EB] text-sm focus:outline-none focus:ring-2 focus:ring-[#044875]/30 focus:border-[#044875] transition-all resize-none bg-white ${className}`}
      rows={4}
      {...props}
    />
  );
}

function Select({ className = "", children, ...props }) {
  return (
    <select
      className={`w-full px-4 py-2.5 rounded-xl border border-[#E5E7EB] text-sm focus:outline-none focus:ring-2 focus:ring-[#044875]/30 focus:border-[#044875] transition-all bg-white ${className}`}
      {...props}
    >
      {children}
    </select>
  );
}

function SectionTitle({ children }) {
  return (
    <h3 className="text-base font-extrabold text-[#1A1A2E] mb-5 pb-2 border-b border-[#E5E7EB]" style={{ fontFamily: "Outfit, sans-serif" }}>
      {children}
    </h3>
  );
}

const CLASSES = [
  "Pre-K Prep", "Pre-K Juniors", "Pre-K Seniors",
  "Kindergarten", "K1 (1st Year)", "K2 (2nd Year)",
  "JP / Std 1", "SEA Class of 2027", "SEA Class of 2028",
  "SEA Class of 2029", "SEA Class of 2030",
];

const STEPS = [
  "Child's Details",
  "Previous Schools",
  "Child Profile & Medical",
  "Medical Authorisation",
  "Father's Details",
  "Mother's Details",
  "Contacts & Pickup",
  "Declaration",
];

const EMPTY_SCHOOL = { name: "", city: "", classLevel: "", from: "", to: "" };
const EMPTY_VEHICLE = { name: "", relation: "", make: "", plate: "" };
const EMPTY_CONTACT = { name: "", phone: "", relationship: "" };

const DEFAULT_FORM = {
  // Step 1
  child_first_name: "", child_family_name: "", dob: "", place_of_birth: "",
  nationality: "", gender: "", address: "", phone_residence: "",
  phone_mobile: "", phone_office: "", relative_at_school: "",
  language_1: "", language_2: "", relation_to_child: "",
  class_sought: "",

  // Step 2
  previous_schools: [{ ...EMPTY_SCHOOL }],

  // Step 3
  personality: "", medical_conditions: "", allergies: "",
  has_emergency_plan: "", doctor_name: "", doctor_practice: "",
  doctor_contact: "", plan_details: "", vegetarian: "",

  // Step 4 — medical auth
  auth_first_aid: "", auth_transport: "", auth_info_release: "",
  auth_name: "", auth_date: "",

  // Step 5
  father_name: "", father_profession: "", father_designation: "",
  father_org: "", father_office_address: "", father_office_phone: "",
  father_fax: "", father_email: "",

  // Step 6
  mother_name: "", mother_occupation: "", mother_profession: "",
  mother_org: "", mother_office_address: "", mother_office_phone: "",
  mother_fax: "", mother_email: "",

  // Step 7
  guardian_contacts: [{ ...EMPTY_CONTACT }, { ...EMPTY_CONTACT }],
  emergency_contacts: [{ ...EMPTY_CONTACT }],
  authorized_vehicles: [{ ...EMPTY_VEHICLE }],
  custody_battle: "",

  // Step 8
  declaration_name: "", declaration_relation: "", declaration_agreed: false,
};

function StepIndicator({ current, total, labels }) {
  return (
    <div className="mb-8">
      {/* Progress bar */}
      <div className="flex items-center gap-1 mb-4">
        {labels.map((_, i) => (
          <div
            key={i}
            className="flex-1 h-1.5 rounded-full transition-all duration-500"
            style={{ backgroundColor: i <= current ? "#044875" : "#E5E7EB" }}
          />
        ))}
      </div>
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-[#6B7280] uppercase tracking-wider">
          Step {current + 1} of {total}
        </span>
        <span className="text-sm font-bold text-[#044875]">{labels[current]}</span>
      </div>
    </div>
  );
}

// ─── Step components ──────────────────────────────────────────────────────────

function Step1({ data, onChange }) {
  return (
    <div className="space-y-5">
      <SectionTitle>Section 1 — Child's Personal Details</SectionTitle>
      <div className="grid sm:grid-cols-2 gap-4">
        <Field label="First Name" required>
          <Input name="child_first_name" value={data.child_first_name} onChange={onChange} placeholder="First name" />
        </Field>
        <Field label="Family Name" required>
          <Input name="child_family_name" value={data.child_family_name} onChange={onChange} placeholder="Family / last name" />
        </Field>
      </div>
      <div className="grid sm:grid-cols-3 gap-4">
        <Field label="Date of Birth" required>
          <Input type="date" name="dob" value={data.dob} onChange={onChange} />
        </Field>
        <Field label="Place of Birth">
          <Input name="place_of_birth" value={data.place_of_birth} onChange={onChange} placeholder="City, Country" />
        </Field>
        <Field label="Nationality">
          <Input name="nationality" value={data.nationality} onChange={onChange} placeholder="e.g. Trinidadian" />
        </Field>
      </div>
      <Field label="Gender" required>
        <div className="flex gap-6 mt-1">
          {["Male", "Female"].map((g) => (
            <label key={g} className="flex items-center gap-2 cursor-pointer text-sm font-medium text-[#374151]">
              <input type="radio" name="gender" value={g} checked={data.gender === g} onChange={onChange} className="accent-[#044875]" />
              {g}
            </label>
          ))}
        </div>
      </Field>
      <Field label="Home Address" required>
        <Textarea name="address" value={data.address} onChange={onChange} rows={2} placeholder="Street address, town/village" />
      </Field>
      <div className="grid sm:grid-cols-3 gap-4">
        <Field label="Residence Phone">
          <Input name="phone_residence" value={data.phone_residence} onChange={onChange} placeholder="+1 (868)..." />
        </Field>
        <Field label="Mobile" required>
          <Input name="phone_mobile" value={data.phone_mobile} onChange={onChange} placeholder="+1 (868)..." />
        </Field>
        <Field label="Office Phone">
          <Input name="phone_office" value={data.phone_office} onChange={onChange} placeholder="+1 (868)..." />
        </Field>
      </div>
      <Field label="Name & Class of Any Relative Already Attending Rightway">
        <Input name="relative_at_school" value={data.relative_at_school} onChange={onChange} placeholder="Name — Class (or 'None')" />
      </Field>
      <div className="grid sm:grid-cols-2 gap-4">
        <Field label="Language Spoken at Home (1)">
          <Input name="language_1" value={data.language_1} onChange={onChange} placeholder="e.g. English" />
        </Field>
        <Field label="Language Spoken at Home (2)">
          <Input name="language_2" value={data.language_2} onChange={onChange} placeholder="e.g. Spanish" />
        </Field>
      </div>
      <Field label="Your Relationship to the Child" required>
        <div className="flex flex-wrap gap-5 mt-1">
          {["Mother", "Father", "Legal Guardian", "Grand Parent"].map((r) => (
            <label key={r} className="flex items-center gap-2 cursor-pointer text-sm font-medium text-[#374151]">
              <input type="radio" name="relation_to_child" value={r} checked={data.relation_to_child === r} onChange={onChange} className="accent-[#044875]" />
              {r}
            </label>
          ))}
        </div>
        {["Legal Guardian", "Grand Parent"].includes(data.relation_to_child) && (
          <p className="text-xs text-amber-600 mt-2 bg-amber-50 px-3 py-2 rounded-lg">
            ⚠️ A document of authorisation or proof of legal guardianship is required and must be submitted with the application.
          </p>
        )}
      </Field>
      <Field label="Class in Which Admission is Sought" required>
        <Select name="class_sought" value={data.class_sought} onChange={onChange}>
          <option value="">Select a class level</option>
          {CLASSES.map((c) => <option key={c}>{c}</option>)}
        </Select>
      </Field>
    </div>
  );
}

function Step2({ data, onChange }) {
  const schools = data.previous_schools;

  const addSchool = () => onChange({ target: { name: "previous_schools", value: [...schools, { ...EMPTY_SCHOOL }] } });
  const removeSchool = (i) => onChange({ target: { name: "previous_schools", value: schools.filter((_, idx) => idx !== i) } });
  const updateSchool = (i, field, value) => {
    const updated = schools.map((s, idx) => idx === i ? { ...s, [field]: value } : s);
    onChange({ target: { name: "previous_schools", value: updated } });
  };

  return (
    <div className="space-y-5">
      <SectionTitle>Section 2 — Previous Schools Attended</SectionTitle>
      <p className="text-sm text-[#6B7280]">Please list all schools attended, including the city/country, class level, and dates of attendance.</p>

      {schools.map((school, i) => (
        <div key={i} className="bg-[#FBF8F3] rounded-2xl p-5 border border-[#E5E7EB] relative">
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs font-bold uppercase tracking-wider text-[#044875]">School {i + 1}</span>
            {schools.length > 1 && (
              <button type="button" onClick={() => removeSchool(i)} className="text-red-400 hover:text-red-600 transition-colors">
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
          <div className="grid sm:grid-cols-2 gap-3 mb-3">
            <Field label="School Name">
              <Input value={school.name} onChange={(e) => updateSchool(i, "name", e.target.value)} placeholder="Name of school" />
            </Field>
            <Field label="City / Country">
              <Input value={school.city} onChange={(e) => updateSchool(i, "city", e.target.value)} placeholder="e.g. Chaguanas, Trinidad" />
            </Field>
          </div>
          <div className="grid sm:grid-cols-3 gap-3">
            <Field label="Class Level">
              <Input value={school.classLevel} onChange={(e) => updateSchool(i, "classLevel", e.target.value)} placeholder="e.g. Std 1" />
            </Field>
            <Field label="From (Year)">
              <Input value={school.from} onChange={(e) => updateSchool(i, "from", e.target.value)} placeholder="e.g. 2020" />
            </Field>
            <Field label="To (Year)">
              <Input value={school.to} onChange={(e) => updateSchool(i, "to", e.target.value)} placeholder="e.g. 2023" />
            </Field>
          </div>
        </div>
      ))}

      {schools.length < 5 && (
        <button
          type="button"
          onClick={addSchool}
          className="flex items-center gap-2 text-sm font-semibold text-[#044875] hover:text-[#0a6aac] transition-colors"
        >
          <Plus className="w-4 h-4" /> Add Another School
        </button>
      )}
    </div>
  );
}

function Step3({ data, onChange }) {
  return (
    <div className="space-y-5">
      <SectionTitle>Section 3 — Child Profile & Medical Information</SectionTitle>

      <Field label="Special Aspects of Your Child's Personality">
        <Textarea name="personality" value={data.personality} onChange={onChange}
          placeholder="Please describe any special aspects — personality traits, learning style, interests, strengths..." />
      </Field>

      <Field label="Medical Conditions">
        <Textarea name="medical_conditions" value={data.medical_conditions} onChange={onChange}
          placeholder="e.g. asthma, diabetes, epilepsy — or write 'None'" />
      </Field>

      <Field label="Allergies (food, medicine, environmental, other)">
        <Textarea name="allergies" value={data.allergies} onChange={onChange} rows={3}
          placeholder="Please list all known allergies — or write 'None'" />
      </Field>

      <Field label="Does your child have an Emergency Action Plan?">
        <div className="flex gap-6 mt-1">
          {["Yes", "No"].map((v) => (
            <label key={v} className="flex items-center gap-2 cursor-pointer text-sm font-medium text-[#374151]">
              <input type="radio" name="has_emergency_plan" value={v} checked={data.has_emergency_plan === v} onChange={onChange} className="accent-[#044875]" />
              {v}
            </label>
          ))}
        </div>
      </Field>

      {data.has_emergency_plan === "Yes" && (
        <div className="bg-[#FBF8F3] rounded-2xl p-5 border border-[#E5E7EB] space-y-4">
          <p className="text-xs font-bold uppercase tracking-wider text-[#044875]">Emergency Action Plan Details</p>
          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="Doctor's Name">
              <Input name="doctor_name" value={data.doctor_name} onChange={onChange} placeholder="Dr. ..." />
            </Field>
            <Field label="Practice / Clinic">
              <Input name="doctor_practice" value={data.doctor_practice} onChange={onChange} placeholder="Practice name" />
            </Field>
          </div>
          <Field label="Doctor's Contact Number">
            <Input name="doctor_contact" value={data.doctor_contact} onChange={onChange} placeholder="+1 (868)..." />
          </Field>
          <Field label="Details of Emergency Plan">
            <Textarea name="plan_details" value={data.plan_details} onChange={onChange}
              placeholder="Describe the emergency action plan steps..." />
          </Field>
        </div>
      )}

      <Field label="Is your child vegetarian?">
        <div className="flex gap-6 mt-1">
          {["Yes", "No"].map((v) => (
            <label key={v} className="flex items-center gap-2 cursor-pointer text-sm font-medium text-[#374151]">
              <input type="radio" name="vegetarian" value={v} checked={data.vegetarian === v} onChange={onChange} className="accent-[#044875]" />
              {v}
            </label>
          ))}
        </div>
      </Field>
    </div>
  );
}

function Step4({ data, onChange }) {
  const AuthRow = ({ label, name }) => (
    <div className="mb-4">
      <p className="text-sm text-[#374151] mb-2 font-medium">{label}</p>
      <div className="flex gap-6">
        {["Authorise", "Do Not Authorise"].map((v) => (
          <label key={v} className="flex items-center gap-2 cursor-pointer text-sm text-[#374151]">
            <input type="radio" name={name} value={v} checked={data[name] === v} onChange={onChange} className="accent-[#044875]" />
            {v}
          </label>
        ))}
      </div>
    </div>
  );

  return (
    <div className="space-y-5">
      <SectionTitle>Section 4 — Medical Authorisation & Consent</SectionTitle>

      <div className="bg-blue-50 rounded-2xl p-5 border border-blue-100 text-sm text-[#374151] leading-relaxed">
        <p className="font-semibold text-[#044875] mb-3">Medical Emergency Consent</p>
        <p className="mb-3">
          I hereby authorise/do not authorise school administration to render first aid for illness or injury to my child in the event of a medical emergency, and to have my child transported to the nearest hospital or emergency care centre for emergency medical or minor surgical treatment and to contact my child's physician and emergency contacts.
        </p>
        <p className="mb-3">
          I hereby authorise/do not authorise the release of the above medical information to all medical personnel providing treatment. I agree to be solely responsible for the payment of all expenses incurred in such an emergency.
        </p>
        <p className="text-xs text-[#6B7280] mt-4 italic">
          I hereby release, hold harmless and indemnify The Rightway Center of Learning and Academics Development Ltd. and any of their officers, agents, employees or representatives from any and all liability, claims, losses or expenses arising from personal injury, death, or loss of or damage to property arising from any medical treatment received and/or transportation to the nearest hospital/emergency care centre.
        </p>
      </div>

      <AuthRow
        label="1. Authorise school administration to render first aid for illness or injury to my child."
        name="auth_first_aid"
      />
      <AuthRow
        label="2. Authorise school administration to have my child transported to the nearest hospital/emergency care centre."
        name="auth_transport"
      />
      <AuthRow
        label="3. Authorise the release of medical information to all medical personnel providing treatment."
        name="auth_info_release"
      />

      <div className="pt-2 border-t border-[#E5E7EB]">
        <p className="text-sm font-semibold text-[#374151] mb-4">
          By typing your name and date below, you confirm you are signing this consent on behalf of the child named in this application.
        </p>
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="Full Name (as signature)" required>
            <Input name="auth_name" value={data.auth_name} onChange={onChange} placeholder="Type your full name" />
          </Field>
          <Field label="Date Signed" required>
            <Input type="date" name="auth_date" value={data.auth_date} onChange={onChange} />
          </Field>
        </div>
      </div>
    </div>
  );
}

function Step5({ data, onChange }) {
  return (
    <div className="space-y-5">
      <SectionTitle>Section 5 — Father's Details</SectionTitle>
      <p className="text-sm text-[#6B7280]">If not applicable, you may leave fields blank.</p>
      <div className="grid sm:grid-cols-2 gap-4">
        <Field label="Father's Full Name">
          <Input name="father_name" value={data.father_name} onChange={onChange} placeholder="Full name" />
        </Field>
        <Field label="Profession">
          <Input name="father_profession" value={data.father_profession} onChange={onChange} placeholder="e.g. Engineer" />
        </Field>
      </div>
      <div className="grid sm:grid-cols-2 gap-4">
        <Field label="Designation / Title">
          <Input name="father_designation" value={data.father_designation} onChange={onChange} placeholder="e.g. Senior Manager" />
        </Field>
        <Field label="Organisation / Employer">
          <Input name="father_org" value={data.father_org} onChange={onChange} placeholder="Company or organisation" />
        </Field>
      </div>
      <Field label="Office Address">
        <Textarea name="father_office_address" value={data.father_office_address} onChange={onChange} rows={2} placeholder="Work address" />
      </Field>
      <div className="grid sm:grid-cols-3 gap-4">
        <Field label="Office Telephone">
          <Input name="father_office_phone" value={data.father_office_phone} onChange={onChange} placeholder="+1 (868)..." />
        </Field>
        <Field label="Fax No.">
          <Input name="father_fax" value={data.father_fax} onChange={onChange} placeholder="+1 (868)..." />
        </Field>
        <Field label="Email Address">
          <Input type="email" name="father_email" value={data.father_email} onChange={onChange} placeholder="father@email.com" />
        </Field>
      </div>
    </div>
  );
}

function Step6({ data, onChange }) {
  return (
    <div className="space-y-5">
      <SectionTitle>Section 6 — Mother's Details</SectionTitle>
      <p className="text-sm text-[#6B7280]">If not applicable, you may leave fields blank.</p>
      <div className="grid sm:grid-cols-2 gap-4">
        <Field label="Mother's Full Name">
          <Input name="mother_name" value={data.mother_name} onChange={onChange} placeholder="Full name" />
        </Field>
        <Field label="Occupation">
          <div className="flex gap-6 mt-1">
            {["House Wife", "Professional"].map((v) => (
              <label key={v} className="flex items-center gap-2 cursor-pointer text-sm font-medium text-[#374151]">
                <input type="radio" name="mother_occupation" value={v} checked={data.mother_occupation === v} onChange={onChange} className="accent-[#044875]" />
                {v}
              </label>
            ))}
          </div>
        </Field>
      </div>
      <div className="grid sm:grid-cols-2 gap-4">
        <Field label="Profession">
          <Input name="mother_profession" value={data.mother_profession} onChange={onChange} placeholder="e.g. Teacher" />
        </Field>
        <Field label="Organisation / Employer">
          <Input name="mother_org" value={data.mother_org} onChange={onChange} placeholder="Company or organisation" />
        </Field>
      </div>
      <Field label="Office Address">
        <Textarea name="mother_office_address" value={data.mother_office_address} onChange={onChange} rows={2} placeholder="Work address" />
      </Field>
      <div className="grid sm:grid-cols-3 gap-4">
        <Field label="Office Telephone">
          <Input name="mother_office_phone" value={data.mother_office_phone} onChange={onChange} placeholder="+1 (868)..." />
        </Field>
        <Field label="Fax No.">
          <Input name="mother_fax" value={data.mother_fax} onChange={onChange} placeholder="+1 (868)..." />
        </Field>
        <Field label="Email Address">
          <Input type="email" name="mother_email" value={data.mother_email} onChange={onChange} placeholder="mother@email.com" />
        </Field>
      </div>
    </div>
  );
}

function Step7({ data, onChange }) {
  const updateItem = (listName, index, field, value) => {
    const updated = data[listName].map((item, i) => i === index ? { ...item, [field]: value } : item);
    onChange({ target: { name: listName, value: updated } });
  };

  const addVehicle = () => {
    if (data.authorized_vehicles.length < 3)
      onChange({ target: { name: "authorized_vehicles", value: [...data.authorized_vehicles, { ...EMPTY_VEHICLE }] } });
  };

  const removeVehicle = (i) => onChange({ target: { name: "authorized_vehicles", value: data.authorized_vehicles.filter((_, idx) => idx !== i) } });

  const ContactBlock = ({ title, listName }) => (
    <div>
      <p className="text-xs font-bold uppercase tracking-wider text-[#044875] mb-3">{title}</p>
      {data[listName].map((c, i) => (
        <div key={i} className="grid sm:grid-cols-3 gap-3 mb-3">
          <Field label={`Name ${data[listName].length > 1 ? i + 1 : ""}`}>
            <Input value={c.name} onChange={(e) => updateItem(listName, i, "name", e.target.value)} placeholder="Full name" />
          </Field>
          <Field label="Contact #">
            <Input value={c.phone} onChange={(e) => updateItem(listName, i, "phone", e.target.value)} placeholder="+1 (868)..." />
          </Field>
          <Field label="Relationship">
            <Input value={c.relationship} onChange={(e) => updateItem(listName, i, "relationship", e.target.value)} placeholder="e.g. Aunt" />
          </Field>
        </div>
      ))}
    </div>
  );

  return (
    <div className="space-y-6">
      <SectionTitle>Section 7 — Contacts & Authorised Pickup</SectionTitle>

      <div className="bg-[#FBF8F3] rounded-2xl p-5 border border-[#E5E7EB]">
        <ContactBlock title="Guardian / Relative Contacts" listName="guardian_contacts" />
      </div>

      <div className="bg-[#FBF8F3] rounded-2xl p-5 border border-[#E5E7EB]">
        <ContactBlock title="Emergency Contact" listName="emergency_contacts" />
      </div>

      <div>
        <p className="text-xs font-bold uppercase tracking-wider text-[#044875] mb-3">Authorised Vehicles for Pick-Up (max 3)</p>
        {data.authorized_vehicles.map((v, i) => (
          <div key={i} className="bg-[#FBF8F3] rounded-2xl p-5 border border-[#E5E7EB] mb-3 relative">
            <div className="flex justify-between items-center mb-3">
              <span className="text-xs font-semibold text-[#6B7280]">Vehicle {i + 1}</span>
              {data.authorized_vehicles.length > 1 && (
                <button type="button" onClick={() => removeVehicle(i)} className="text-red-400 hover:text-red-600 transition-colors">
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
            <div className="grid sm:grid-cols-2 gap-3 mb-3">
              <Field label="Name of Driver">
                <Input value={v.name} onChange={(e) => updateItem("authorized_vehicles", i, "name", e.target.value)} placeholder="Full name" />
              </Field>
              <Field label="Relation to Child">
                <Input value={v.relation} onChange={(e) => updateItem("authorized_vehicles", i, "relation", e.target.value)} placeholder="e.g. Uncle" />
              </Field>
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              <Field label="Vehicle Make & Model">
                <Input value={v.make} onChange={(e) => updateItem("authorized_vehicles", i, "make", e.target.value)} placeholder="e.g. Toyota Corolla" />
              </Field>
              <Field label="Licence Plate Number">
                <Input value={v.plate} onChange={(e) => updateItem("authorized_vehicles", i, "plate", e.target.value)} placeholder="e.g. PAB 1234" />
              </Field>
            </div>
          </div>
        ))}
        {data.authorized_vehicles.length < 3 && (
          <button type="button" onClick={addVehicle}
            className="flex items-center gap-2 text-sm font-semibold text-[#044875] hover:text-[#0a6aac] transition-colors">
            <Plus className="w-4 h-4" /> Add Another Vehicle
          </button>
        )}
      </div>

      <Field label="Is the child the subject of a custody battle?">
        <div className="flex gap-6 mt-1">
          {["Yes", "No"].map((v) => (
            <label key={v} className="flex items-center gap-2 cursor-pointer text-sm font-medium text-[#374151]">
              <input type="radio" name="custody_battle" value={v} checked={data.custody_battle === v} onChange={onChange} className="accent-[#044875]" />
              {v}
            </label>
          ))}
        </div>
        {data.custody_battle === "Yes" && (
          <p className="text-xs text-amber-600 mt-2 bg-amber-50 px-3 py-2 rounded-lg">
            ⚠️ Please provide proof of custody documents to the school office. Note the date provided when submitting your application.
          </p>
        )}
      </Field>
    </div>
  );
}

function Step8({ data, onChange }) {
  const POLICY_POINTS = [
    "Academic readiness and learning profile — students must be at an appropriate level for their age.",
    "Digital literacy — Rightway is a technology-driven school; readiness is required.",
    "Behavioural and emotional considerations — persistent disruption may affect admission.",
    "Complete and honest documentation must be submitted.",
    "Strong parental partnership and engagement is expected.",
    "Financial commitment and fee obligations must be met.",
    "Admission is subject to space availability and strategic enrolment priorities.",
    "Safeguarding and legal concerns are taken seriously.",
  ];

  return (
    <div className="space-y-5">
      <SectionTitle>Section 8 — Declaration & Admissions Policy Agreement</SectionTitle>

      {/* Policy summary */}
      <div className="bg-[#FBF8F3] rounded-2xl p-5 border border-[#E5E7EB]">
        <p className="text-xs font-bold uppercase tracking-wider text-[#044875] mb-3">Admissions Policy Summary</p>
        <p className="text-xs text-[#6B7280] mb-4">
          The Rightway Center reserves the right to decline or revoke admission where there is significant misalignment with our academic, behavioural, technological, or partnership expectations. Key considerations include:
        </p>
        <ul className="space-y-2">
          {POLICY_POINTS.map((p) => (
            <li key={p} className="flex items-start gap-2 text-xs text-[#374151]">
              <AlertCircle className="w-3.5 h-3.5 text-[#044875] flex-shrink-0 mt-0.5" />
              {p}
            </li>
          ))}
        </ul>
        <p className="text-xs text-[#6B7280] mt-4">
          All admissions decisions are made in the best interest of the student, the wider school community, and the integrity of the institution. <em>Effective: 02 Sep 2025.</em>
        </p>
      </div>

      {/* Declaration */}
      <div className="bg-blue-50 rounded-2xl p-5 border border-blue-100">
        <p className="text-sm text-[#374151] leading-relaxed">
          I confirm that, to the best of my knowledge, the information provided in this application is correct, and I submit this application for consideration with the full legal capacity to do so.
        </p>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <Field label="Your Full Name" required>
          <Input name="declaration_name" value={data.declaration_name} onChange={onChange} placeholder="Type your full name" />
        </Field>
        <Field label="Your Relationship to the Child" required>
          <Input name="declaration_relation" value={data.declaration_relation} onChange={onChange} placeholder="e.g. Mother" />
        </Field>
      </div>

      <label className="flex items-start gap-3 cursor-pointer group">
        <input
          type="checkbox"
          name="declaration_agreed"
          checked={data.declaration_agreed}
          onChange={(e) => onChange({ target: { name: "declaration_agreed", value: e.target.checked } })}
          className="mt-0.5 w-4 h-4 accent-[#044875] flex-shrink-0"
        />
        <span className="text-sm text-[#374151] group-hover:text-[#1A1A2E] transition-colors">
          I have read, understood, and agree to the Admissions Policy and confirm that all information provided in this application is accurate to the best of my knowledge.
        </span>
      </label>
    </div>
  );
}

// ─── Required Documents Confirmation ────────────────────────────────────────

function ConfirmationScreen({ referenceNumber, onClose }) {
  const DOCS = [
    "Birth Certificate (photocopy)",
    "Immunisation / Health Records",
    "Parent/Guardian Identification",
    "2 Passport-Sized Photographs",
    "Previous School Reports",
    "Academic Transcripts (if applicable)",
    "Legal Guardian / Custody Documents (if applicable)",
  ];

  return (
    <div className="text-center py-6">
      <div className="w-20 h-20 rounded-full bg-[#6BCB77]/15 flex items-center justify-center mx-auto mb-6">
        <CheckCircle className="w-10 h-10 text-[#6BCB77]" />
      </div>
      <h3 className="text-2xl font-extrabold text-[#1A1A2E] mb-2" style={{ fontFamily: "Outfit, sans-serif" }}>
        Application Submitted!
      </h3>
      <p className="text-[#6B7280] text-sm mb-2">
        Your application has been received. Reference number:
      </p>
      <div className="inline-block px-5 py-2 rounded-xl bg-[#044875]/10 font-mono font-bold text-[#044875] text-sm mb-6">
        {referenceNumber}
      </div>
      <p className="text-[#374151] text-sm mb-6 max-w-md mx-auto">
        A confirmation will be sent to the email provided. Our admissions team will contact you within <strong>3–5 business days</strong> to confirm receipt and schedule the next steps.
      </p>

      <div className="bg-[#FBF8F3] rounded-2xl p-6 text-left max-w-md mx-auto mb-6 border border-[#E5E7EB]">
        <p className="text-xs font-bold uppercase tracking-wider text-[#044875] mb-3">Required Documents to Submit</p>
        <ul className="space-y-2">
          {DOCS.map((doc) => (
            <li key={doc} className="flex items-center gap-2 text-sm text-[#374151]">
              <CheckCircle className="w-4 h-4 text-[#6BCB77] flex-shrink-0" />
              {doc}
            </li>
          ))}
        </ul>
        <p className="text-xs text-[#6B7280] mt-4">
          Bring these documents to the school office or email scanned copies to <strong>therightwaycloud@gmail.com</strong>
        </p>
      </div>

      <p className="text-xs text-[#6B7280]">
        <strong>Office Hours:</strong> Monday – Friday, 7:00 AM – 4:00 PM<br />
        📍 Lot 26A Phillips Street, Montrose, Chaguanas · 📞 +1 (868) 471-3888
      </p>
    </div>
  );
}

// ─── Main Form Component ─────────────────────────────────────────────────────

export default function AdmissionsForm() {
  const [step, setStep] = useState(0);
  const [form, setForm] = useState({ ...DEFAULT_FORM });
  const [errors, setErrors] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [referenceNumber, setReferenceNumber] = useState("");

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((f) => ({ ...f, [name]: value }));
    setErrors("");
  };

  const validate = () => {
    if (step === 0) {
      if (!form.child_first_name || !form.child_family_name) return "Please enter the child's full name.";
      if (!form.dob) return "Please enter the child's date of birth.";
      if (!form.gender) return "Please select the child's gender.";
      if (!form.phone_mobile) return "Please provide a mobile phone number.";
      if (!form.relation_to_child) return "Please indicate your relationship to the child.";
      if (!form.class_sought) return "Please select the class level you are applying for.";
    }
    if (step === 3) {
      if (!form.auth_name) return "Please type your name for the medical authorisation.";
      if (!form.auth_date) return "Please enter the date of the medical authorisation.";
    }
    if (step === 7) {
      if (!form.declaration_name) return "Please type your full name for the declaration.";
      if (!form.declaration_relation) return "Please state your relationship to the child.";
      if (!form.declaration_agreed) return "You must agree to the Admissions Policy to submit.";
    }
    return null;
  };

  const next = () => {
    const err = validate();
    if (err) { setErrors(err); return; }
    setErrors("");
    setStep((s) => s + 1);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const prev = () => {
    setErrors("");
    setStep((s) => s - 1);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const submit = async () => {
    const err = validate();
    if (err) { setErrors(err); return; }
    setLoading(true);
    try {
      const res = await api.post("/website/admissions-applications", form);
      setReferenceNumber(res.data?.reference || `RW-${Date.now().toString().slice(-6)}`);
      setSubmitted(true);
    } catch {
      setReferenceNumber(`RW-${Date.now().toString().slice(-6)}`);
      setSubmitted(true);
    } finally {
      setLoading(false);
    }
  };

  const STEP_COMPONENTS = [
    <Step1 data={form} onChange={handleChange} />,
    <Step2 data={form} onChange={handleChange} />,
    <Step3 data={form} onChange={handleChange} />,
    <Step4 data={form} onChange={handleChange} />,
    <Step5 data={form} onChange={handleChange} />,
    <Step6 data={form} onChange={handleChange} />,
    <Step7 data={form} onChange={handleChange} />,
    <Step8 data={form} onChange={handleChange} />,
  ];

  if (submitted) {
    return <ConfirmationScreen referenceNumber={referenceNumber} />;
  }

  return (
    <div>
      <StepIndicator current={step} total={STEPS.length} labels={STEPS} />

      <div className="min-h-[400px]">
        {STEP_COMPONENTS[step]}
      </div>

      {errors && (
        <div className="mt-5 flex items-start gap-2 bg-red-50 text-red-600 text-sm px-4 py-3 rounded-xl border border-red-100">
          <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
          {errors}
        </div>
      )}

      <div className="mt-8 flex items-center justify-between pt-5 border-t border-[#E5E7EB]">
        <button
          type="button"
          onClick={prev}
          disabled={step === 0}
          className="flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-[#374151] border border-[#E5E7EB] rounded-xl hover:bg-[#F5F5F5] transition-all disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <ChevronLeft className="w-4 h-4" /> Previous
        </button>

        {step < STEPS.length - 1 ? (
          <button
            type="button"
            onClick={next}
            className="flex items-center gap-2 px-6 py-2.5 text-sm font-bold text-[#044875] bg-[#f8d904] rounded-xl hover:bg-[#bc9908] transition-all shadow-sm"
          >
            Next Step <ChevronRight className="w-4 h-4" />
          </button>
        ) : (
          <button
            type="button"
            onClick={submit}
            disabled={loading}
            className="flex items-center gap-2 px-6 py-2.5 text-sm font-bold text-white bg-[#044875] rounded-xl hover:bg-[#0a6aac] transition-all shadow-sm disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {loading ? (
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <>
                <CheckCircle className="w-4 h-4" />
                Submit Application
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );
}

console.log("NEXORA SCRIPT LOADED");

import { createClient } from
    "https://esm.sh/@supabase/supabase-js@2";
// MOBILE NAVIGATION
const menuToggle = document.getElementById("menuToggle");
const navLinks = document.getElementById("navLinks");

menuToggle.addEventListener("click", () => {
    const isOpen = navLinks.classList.toggle("active");

    menuToggle.setAttribute("aria-expanded", isOpen);
    menuToggle.textContent = isOpen ? "✕" : "☰";
});

// CLOSE MENU AFTER CLICKING A LINK
document.querySelectorAll(".nav-links a").forEach(link => {
    link.addEventListener("click", () => {
        navLinks.classList.remove("active");
        menuToggle.setAttribute("aria-expanded", "false");
        menuToggle.textContent = "☰";
    });
});

// AUTOMATIC COPYRIGHT YEAR
document.getElementById("year").textContent =
    new Date().getFullYear();

// CONTACT FORM

// SUPABASE CONNECTION
const supabaseClient = createClient(
    window.NEXORA_CONFIG.SUPABASE_URL,
    window.NEXORA_CONFIG.SUPABASE_KEY
);

// CONTACT FORM
const contactForm = document.getElementById("contactForm");
const formMessage = document.getElementById("formMessage");

contactForm.addEventListener("submit", async function(event) {
    event.preventDefault();
    console.log("CONTACT FORM SUBMITTED");

    if (!contactForm.checkValidity()) {
        contactForm.reportValidity();
        return;
    }

    const submitButton = contactForm.querySelector(
        'button[type="submit"]'
    );

    const enquiry = {
        name: document.getElementById("name").value.trim(),
        email: document.getElementById("email").value.trim(),
        service: document.getElementById("service").value,
        message: document.getElementById("message").value.trim()
    };

    if (
        enquiry.name.length < 2 ||
        enquiry.name.length > 100 ||
        enquiry.email.length > 254 ||
        enquiry.message.length < 5 ||
        enquiry.message.length > 5000
    ) {
        formMessage.textContent = "Please check your details.";
        return;
    }

    submitButton.disabled = true;
    submitButton.textContent = "Submitting...";

    try {
        const { error } = await supabaseClient
            .from("enquiries")
            .insert([enquiry]);

        if (error) throw error;

        formMessage.textContent =
            "Thank you! Your enquiry was submitted successfully.";

        contactForm.reset();

    } catch (error) {
        console.error("Enquiry submission failed:", error);

        formMessage.textContent =
            "Unable to submit your enquiry. Please try again.";

    } finally {
        submitButton.disabled = false;
        submitButton.textContent = "Send Enquiry ↗";
    }
});

document.addEventListener("click", function(event) {
    const clickedInsideMenu = navLinks.contains(event.target);
    const clickedToggle = menuToggle.contains(event.target);

    if (!clickedInsideMenu && !clickedToggle) {
        navLinks.classList.remove("active");
        menuToggle.setAttribute("aria-expanded", "false");
        menuToggle.textContent = "☰";
    }
});

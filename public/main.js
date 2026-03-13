document.addEventListener("DOMContentLoaded", function () {

    let wrapper = document.querySelector('.wrapper'),
        signUpLinks = document.querySelectorAll('.signup-link'),
        signInLinks = document.querySelectorAll('.signin-link');

    signUpLinks.forEach(link => {
        link.addEventListener('click', () => {
            wrapper.classList.add('animated-signin');
            wrapper.classList.remove('animated-signup');
        });
    });

    signInLinks.forEach(link => {
        link.addEventListener('click', () => {
            wrapper.classList.add('animated-signup');
            wrapper.classList.remove('animated-signin');
        });
    });

    const showPopup = (message) => {
        const popup = document.getElementById('popup');
        const popupMessage = document.getElementById('popupMessage');
        popupMessage.innerHTML = message;
        popup.classList.add('visible');
        setTimeout(() => popup.classList.remove('visible'), 4000);
    };

    const disableButton = (form, disable) => {
        form.querySelector("button").disabled = disable;
    };

    // ================= REGISTER =================
    const registerForm = document.getElementById('registerForm');
    if (registerForm) {
        registerForm.addEventListener('submit', async function (e) {
            e.preventDefault();

            const username = this.username.value.trim();
            const email = this.email.value.trim();
            const password = this.password.value.trim();

            if (username.length < 3) {
                showPopup("Username must be at least 3 characters long.");
                return;
            }
            if (!email.match(/^\S+@\S+\.\S+$/)) {
                showPopup("Enter a valid email address.");
                return;
            }
            if (password.length < 6) {
                showPopup("Password must be at least 6 characters long.");
                return;
            }

            disableButton(this, true);

            try {
                const response = await fetch('/register', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username, email, password }),
                });

                const result = await response.json();
                showPopup(result.message);

                if (response.ok) {
                    wrapper.classList.add('animated-signup');
                    wrapper.classList.remove('animated-signin');
                    this.reset();
                }

            } catch (error) {
                showPopup('Server error. Please try again.');
            }

            disableButton(this, false);
        });
    }

    // ================= LOGIN =================
    const signinForm = document.getElementById('signinForm');
    if (signinForm) {
        signinForm.addEventListener('submit', async function (e) {
            e.preventDefault();

            const email = this.email.value.trim();
            const password = this.password.value.trim();

            if (!email || !password) {
                showPopup("All fields are required.");
                return;
            }

            disableButton(this, true);

            try {
                const response = await fetch('/signin', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email, password }),
                });

                const result = await response.json();
                showPopup(result.message);

                if (response.ok) {
                    setTimeout(() => {
                        window.location.href = '/dashboard';
                    }, 2000);
                }

            } catch (error) {
                showPopup('Server error. Please try again.');
            }

            disableButton(this, false);
        });
    }

});

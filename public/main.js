let wrapper = document.querySelector('.wrapper'),
    signUpLink = document.querySelector('.link .signup-link'),
    signInLink = document.querySelector('.link .signin-link');

signUpLink.addEventListener('click', () => {
    wrapper.classList.add('animated-signin');
    wrapper.classList.remove('animated-signup');
});

signInLink.addEventListener('click', () => {
    wrapper.classList.add('animated-signup');
    wrapper.classList.remove('animated-signin');
});

const showPopup = (message) => {
    const popup = document.getElementById('popup');
    const popupMessage = document.getElementById('popupMessage');
    popupMessage.innerHTML = message;
    popup.classList.add('visible');
    setTimeout(() => closePopup(), 5000); // Auto-close after 5 seconds
};

const closePopup = () => {
    const popup = document.getElementById('popup');
    popup.classList.remove('visible');
};

document.getElementById('registerForm').addEventListener('submit', async function (e) {
    e.preventDefault();

    const formData = new FormData(this);
    const data = Object.fromEntries(formData.entries());

    try {
        const response = await fetch('/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
        });

        const result = await response.json();
        if (response.ok) {
            showPopup(result.message);
        } else {
            showPopup(result.message);
        }
    } catch (error) {
        showPopup('An error occurred. Please try again later.');
    }
});

document.getElementById('signinForm').addEventListener('submit', async function (e) {
    e.preventDefault();

    const formData = new FormData(this);
    const data = Object.fromEntries(formData.entries());

    try {
        const response = await fetch('/signin', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
        });

        const result = await response.json();
        if (response.ok) {
            showPopup(result.message);
            setTimeout(() => (window.location.href = '/dashboard'), 2000);
        } else {
            showPopup(result.message);
        }
    } catch (error) {
        showPopup('An error occurred. Please try again later.');
    }
});

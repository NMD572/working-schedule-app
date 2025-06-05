## Firebase Authentication Setup Guide

If you encounter the error ‘auth/configuration-not-found’, it indicates a problem with your Firebase Authentication configuration. Follow these steps to resolve it:

1.  **Go to the Firebase Console:** Navigate to [https://console.firebase.google.com/](https://console.firebase.google.com/) and select your project.
2.  **Access the Authentication Section:** In the left-hand menu, find and click on the "Authentication" section.
3.  **Enable Sign-in Methods:**
    - If you haven't already set up Authentication, click the "Get started" button.
    - Go to the "Sign-in method" tab.
    - Enable the desired sign-in methods (e.g., Email/Password, Google, Anonymous). Click the pencil icon to enable and configure each method.
    - If using Anonymous sign-in, ensure it is enabled.
4.  **Save Changes:** Make sure to save any changes you make to the sign-in methods.

By following these steps, you should be able to resolve the "auth/configuration-not-found" error and properly set up Firebase Authentication for your project.

## Install lib and start app

npm install

npm install -D tailwindcss@3

npx tailwindcss init -p

npm start

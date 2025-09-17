document.addEventListener('DOMContentLoaded', () => {
  let currentProfile = null;
  let availableBadges = [];
  let currentPage = 1;
  let totalPages = 1;
  let selectedBadgeUrl = null;
  let isLoadingBadges = false;

  // Utility: showToast displays a transient message (e.g. for errors or confirmations)
  function showToast(message, duration = 3000) {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.style.opacity = '1';
    setTimeout(() => {
      toast.style.opacity = '0';
    }, duration);
  }

  // Function to load and display current profile information
  function loadProfile() {
    const profileContainer = document.getElementById('profileContainer');
    profileContainer.innerHTML = '<div class="loading">Loading profile information...</div>';

    chrome.storage.local.get(['apiToken', 'viewerId', 'xPin'], (result) => {
      const token = result.apiToken;
      const viewerId = result.viewerId;
      const xPin = (result.xPin !== undefined && result.xPin !== null) ? String(result.xPin) : "";

      if (!token) {
        profileContainer.innerHTML = '<div class="error">No API token available.</div>';
        return;
      }
      if (!viewerId) {
        profileContainer.innerHTML = '<div class="error">No viewer ID available.</div>';
        return;
      }

      const apiUrl = "https://fotf.my.site.com/aio/services/apexrest/v1/viewer";
      
      fetch(apiUrl, {
        method: 'GET',
        headers: {
          'Authorization': token,
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'x-viewer-id': viewerId,
          'x-pin': xPin,
          'x-experience-name': "Adventures In Odyssey"
        }
      })
      .then(response => {
        if (!response.ok) {
          throw new Error("Network response was not ok: " + response.statusText);
        }
        return response.json();
      })
      .then(data => {
        console.log("Profile data received:", data);
        
        // Find the profile that matches the current viewerId
        let targetProfile = null;
        
        // Handle different possible response structures
        let profiles = null;
        if (data.profiles) {
          // Direct profiles array
          profiles = data.profiles;
        } else if (data.data && data.data.profiles) {
          // Nested in data.profiles
          profiles = data.data.profiles;
        }
        
        if (profiles) {
          targetProfile = profiles.find(profile => profile.viewer_id === viewerId);
        }
        
        if (!targetProfile) {
          console.log("Available profiles:", profiles);
          console.log("Looking for viewerId:", viewerId);
          profileContainer.innerHTML = '<div class="error">Profile not found for current viewer ID: ' + viewerId + '</div>';
          return;
        }

        currentProfile = targetProfile;
        displayProfile(targetProfile);
        
        // Enable the update button
        document.getElementById('updateImageBtn').disabled = false;
      })
      .catch(error => {
        console.error("Error fetching profile:", error);
        profileContainer.innerHTML = '<div class="error">Error loading profile: ' + error.message + '</div>';
      });
    });
  }

  // Function to load available badge images
  function loadBadges(pageNumber = 1, append = false) {
    const badgeContainer = document.getElementById('badgeContainer');
    
    if (isLoadingBadges) return; // Prevent multiple simultaneous requests
    isLoadingBadges = true;
    
    if (!append) {
      badgeContainer.innerHTML = '<div class="loading">Loading available images...</div>';
    } else {
      // Add loading indicator for append
      const loadingDiv = document.createElement('div');
      loadingDiv.className = 'loading';
      loadingDiv.textContent = 'Loading more...';
      badgeContainer.appendChild(loadingDiv);
    }

    chrome.storage.local.get(['apiToken', 'viewerId', 'xPin'], (result) => {
      const token = result.apiToken;
      const viewerId = result.viewerId;
      const xPin = (result.xPin !== undefined && result.xPin !== null) ? String(result.xPin) : "";

      if (!token || !viewerId) {
        badgeContainer.innerHTML = '<div class="error">Authentication data not available.</div>';
        isLoadingBadges = false;
        return;
      }

      const payload = {
        "type": "Badge",
        "pageNumber": pageNumber,
        "pageSize": 25
      };

      fetch("https://fotf.my.site.com/aio/services/apexrest/v1/badge/search", {
        method: 'POST',
        headers: {
          'Authorization': token,
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'x-viewer-id': viewerId,
          'x-pin': xPin,
          'x-experience-name': "Adventures In Odyssey"
        },
        body: JSON.stringify(payload)
      })
      .then(response => {
        if (!response.ok) {
          throw new Error("Network response was not ok: " + response.statusText);
        }
        return response.json();
      })
      .then(data => {
        console.log("Badge data received:", data);
        
        if (data.badges) {
          if (append) {
            availableBadges = availableBadges.concat(data.badges);
          } else {
            availableBadges = data.badges;
          }
          
          if (data.metadata) {
            totalPages = data.metadata.totalPageCount || 1;
            currentPage = data.metadata.pageNumber || 1;
          }
          
          displayBadges(append);
        } else {
          badgeContainer.innerHTML = '<div class="error">No badge data received.</div>';
        }
        
        isLoadingBadges = false;
      })
      .catch(error => {
        console.error("Error fetching badges:", error);
        badgeContainer.innerHTML = '<div class="error">Error loading images: ' + error.message + '</div>';
        isLoadingBadges = false;
      });
    });
  }

  // Function to display badge images in the grid
  function displayBadges(append = false) {
    const badgeContainer = document.getElementById('badgeContainer');
    
    if (!append) {
      badgeContainer.innerHTML = '';
    } else {
      // Remove loading indicator when appending
      const loadingDiv = badgeContainer.querySelector('.loading');
      if (loadingDiv) {
        loadingDiv.remove();
      }
    }

    // Get starting index for new badges
    const startIndex = append ? badgeContainer.children.length : 0;
    const badgesToAdd = append ? availableBadges.slice(startIndex) : availableBadges;

    badgesToAdd.forEach((badge, index) => {
      const badgeImg = document.createElement('img');
      badgeImg.src = badge.icon;
      badgeImg.alt = badge.name;
      badgeImg.className = 'badge-item';
      badgeImg.title = badge.name;
      
      badgeImg.addEventListener('click', () => {
        // Remove selection from other badges
        document.querySelectorAll('.badge-item').forEach(item => {
          item.classList.remove('selected');
        });
        
        // Select this badge
        badgeImg.classList.add('selected');
        selectedBadgeUrl = badge.icon;
        
        // Clear custom URL input
        document.getElementById('imageUrlInput').value = '';
      });

      badgeContainer.appendChild(badgeImg);
    });
  }

  // Function to check if user has scrolled near the bottom of badge container
  function checkScroll() {
    const badgeContainer = document.getElementById('badgeContainer');
    const scrollTop = badgeContainer.scrollTop;
    const scrollHeight = badgeContainer.scrollHeight;
    const clientHeight = badgeContainer.clientHeight;
    
    // If user has scrolled to within 20px of the bottom
    if (scrollTop + clientHeight >= scrollHeight - 20) {
      // Load more if there are more pages and not currently loading
      if (currentPage < totalPages && !isLoadingBadges) {
        loadBadges(currentPage + 1, true);
      }
    }
  }
  function displayProfile(profile) {
    const profileContainer = document.getElementById('profileContainer');
    
    const profileImageSrc = profile.profile_picture || 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPGNpcmNsZSBjeD0iMzAiIGN5PSIzMCIgcj0iMzAiIGZpbGw9IiNjY2MiLz4KPHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIiB4PSIxOCIgeT0iMTgiPgo8cGF0aCBkPSJNMTIgMTJjMi4yMSAwIDQtMS43OSA0LTRzLTEuNzktNC00LTQtNCAxLjc5LTQgNCAxLjc5IDQgNCA0em0wIDJjLTIuNjcgMC04IDEuMzQtOCA0djJoMTZ2LTJjMC0yLjY2LTUuMzMtNC04LTR6IiBmaWxsPSIjOTk5Ii8+Cjwvc3ZnPgo8L3N2Zz4K';
    
    profileContainer.innerHTML = `
      <div class="current-profile">
        <img src="${profileImageSrc}" alt="Profile Image" class="profile-image" onerror="this.src='data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPGNpcmNsZSBjeD0iMzAiIGN5PSIzMCIgcj0iMzAiIGZpbGw9IiNjY2MiLz4KPHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIiB4PSIxOCIgeT0iMTgiPgo8cGF0aCBkPSJNMTIgMTJjMi4yMSAwIDQtMS43OSA0LTRzLTEuNzktNC00LTQtNCAxLjc5LTQgNCAxLjc5IDQgNCA0em0wIDJjLTIuNjcgMC04IDEuMzQtOCA0djJoMTZ2LTJjMC0yLjY2LTUuMzMtNC04LTR6IiBmaWxsPSIjOTk5Ii8+Cjwvc3ZnPgo8L3N2Zz4K'">
        <div class="profile-info">
          <h3>${profile.username || 'Unknown User'}</h3>
          <p><strong>Nickname:</strong> ${profile.nickname || 'Not set'}</p>
          <p><strong>Gender:</strong> ${profile.gender || 'Not specified'}</p>
          <p><strong>Account Owner:</strong> ${profile.account_owner ? 'Yes' : 'No'}</p>
        </div>
      </div>
    `;
  }

  // Function to update profile image
  function updateProfileImage(imageUrl = null) {
    if (!currentProfile) {
      showToast("No profile loaded. Please refresh first.");
      return;
    }

    // Use selected badge URL or custom input URL
    const newImageUrl = imageUrl || selectedBadgeUrl || document.getElementById('imageUrlInput').value.trim();

    if (!newImageUrl) {
      showToast("Please select an image or enter a valid image URL.");
      return;
    }

    chrome.storage.local.get(['apiToken', 'viewerId', 'xPin'], (result) => {
      const token = result.apiToken;
      const viewerId = result.viewerId;
      const xPin = (result.xPin !== undefined && result.xPin !== null) ? String(result.xPin) : "";

      if (!token || !viewerId) {
        showToast("Missing authentication data.");
        return;
      }

      // Create the payload with the updated profile picture
      const payload = {
        contact_id: currentProfile.contact_id,
        nickname: currentProfile.nickname,
        denied_actions: currentProfile.denied_actions,
        viewer_id: currentProfile.viewer_id,
        username: currentProfile.username,
        profile_picture: newImageUrl,
        parental_controls: currentProfile.parental_controls,
        account_owner: currentProfile.account_owner,
        gender: currentProfile.gender
      };

      console.log("Updating profile with payload:", payload);

      const updateBtn = document.getElementById('updateImageBtn');
      updateBtn.disabled = true;
      updateBtn.textContent = 'Updating...';

      const apiUrl = "https://fotf.my.site.com/aio/services/apexrest/v1/viewer";

      fetch(apiUrl, {
        method: 'PUT',
        headers: {
          'Authorization': token,
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'x-viewer-id': viewerId,
          'x-pin': xPin,
          'x-experience-name': "Adventures In Odyssey"
        },
        body: JSON.stringify(payload)
      })
      .then(response => {
        if (!response.ok) {
          return response.json().then(errData => {
            throw new Error(JSON.stringify(errData));
          });
        }
        return response.json();
      })
      .then(data => {
        console.log("Profile update response:", data);
        showToast("Profile image updated successfully!");
        
        // Clear the input field and selection
        document.getElementById('imageUrlInput').value = '';
        selectedBadgeUrl = null;
        document.querySelectorAll('.badge-item').forEach(item => {
          item.classList.remove('selected');
        });
        
        // Reload the profile to show the updated image
        loadProfile();
      })
      .catch(error => {
        console.error("Error updating profile:", error);
        showToast("Error updating profile: " + error.message, 4000);
      })
      .finally(() => {
        updateBtn.disabled = false;
        updateBtn.textContent = 'Update Profile Image';
      });
    });
  }

  // Event listeners
  document.getElementById('updateImageBtn').addEventListener('click', () => {
    updateProfileImage();
  });

  document.getElementById('refreshBtn').addEventListener('click', () => {
    loadProfile();
    loadBadges();
  });

  // Allow Enter key to trigger update
  document.getElementById('imageUrlInput').addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && !document.getElementById('updateImageBtn').disabled) {
      updateProfileImage();
    }
  });

  // Clear badge selection when typing in custom URL
  document.getElementById('imageUrlInput').addEventListener('input', () => {
    selectedBadgeUrl = null;
    document.querySelectorAll('.badge-item').forEach(item => {
      item.classList.remove('selected');
    });
  });

  // Add scroll listener to badge container for infinite scroll
  document.getElementById('badgeContainer').addEventListener('scroll', checkScroll);

  // Load profile and badges on initial popup open
  loadProfile();
  loadBadges();
});
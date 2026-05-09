package com.example.boveda_digital_api.controller;

import com.example.boveda_digital_api.entity.UsersEntity;
import com.example.boveda_digital_api.services.UsersService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.Map;
import java.util.Optional;

@RestController
@RequestMapping("/api/auth")
public class AuthController {
    private final UsersService usersService;

    public AuthController(UsersService usersService) {
        this.usersService = usersService;
    }

    @PostMapping("/login")
    public ResponseEntity<?> login(@RequestBody Map<String, String> credentials) {
        String username = credentials.get("username");
        String password = credentials.get("password");

        Optional<UsersEntity> user = usersService.login(username, password);

        if (user.isPresent()) {
            Map<String, Object> userMap = new HashMap<>();
            userMap.put("id", user.get().getId());
            userMap.put("name", user.get().getName());
            userMap.put("email", user.get().getEmail());
            userMap.put("username", user.get().getUsername());
            userMap.put("public_key", user.get().getPublicKey());
            userMap.put("signing_public_key", user.get().getSigningPublicKey());

            Map<String, Object> response = new HashMap<>();
            response.put("message", "Login exitoso");
            response.put("user", userMap);
            return ResponseEntity.ok(response);
        }

        return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                .body(Map.of("error", "Credenciales inválidas"));
    }

    @PostMapping("/register")
    public ResponseEntity<?> register(@RequestBody UsersEntity userData) {
        if (usersService.findByUsername(userData.getUsername()).isPresent()) {
            return ResponseEntity.status(HttpStatus.CONFLICT)
                    .body(Map.of("error", "El nombre de usuario ya existe"));
        }

        UsersEntity saved = usersService.registerUser(userData);

        Map<String, Object> userMap = new HashMap<>();
        userMap.put("id", saved.getId());
        userMap.put("name", saved.getName());
        userMap.put("email", saved.getEmail());
        userMap.put("username", saved.getUsername());
        userMap.put("public_key", saved.getPublicKey());
        userMap.put("signing_public_key", saved.getSigningPublicKey());

        Map<String, Object> response = new HashMap<>();
        response.put("message", "Usuario registrado exitosamente");
        response.put("user", userMap);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }
}

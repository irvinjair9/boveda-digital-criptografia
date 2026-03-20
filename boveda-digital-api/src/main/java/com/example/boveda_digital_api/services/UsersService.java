package com.example.boveda_digital_api.services;

import com.example.boveda_digital_api.dao.UsersDAO;
import com.example.boveda_digital_api.entity.UsersEntity;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Optional;

@Service
public class UsersService {
    private final UsersDAO usersDAO;

    public UsersService (UsersDAO usersDAO) {
        this.usersDAO = usersDAO;
    }

    public UsersEntity registerUser(UsersEntity usersEntity){
        return usersDAO.save(usersEntity);
    }

    public Optional<UsersEntity> findByUsername(String username) {
        return usersDAO.findByUsername(username);
    }

    // Listar todos los usuarios
    public List<UsersEntity> getAllUsers() {
        return usersDAO.findAll();
    }

    public Optional<UsersEntity> login(String username, String password) {
        Optional<UsersEntity> user = usersDAO.findByUsername(username);
        if (user.isPresent() && user.get().getPassword().equals(password)) {
            return user;
        }
        return Optional.empty();
    }
}
